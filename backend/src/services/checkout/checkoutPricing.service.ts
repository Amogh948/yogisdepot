import {
  DEFAULT_SUPERFAST_DELIVERY_FEE_CENTS,
  DELIVERY_SPEEDS,
  type DeliverySpeed,
} from "../../config/constants";
import { BadRequestError } from "../../errors/AppError";
import { Cart } from "../../models/Cart";
import { getPlatformSettings } from "../../models/PlatformSettings";
import { Product } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { UserScratchReward } from "../../models/UserScratchReward";
import { addCents, applyBps, clampNonNegativeCents, dollarsToCents } from "../../utils/money";
import { couponService } from "../coupons/coupon.service";
import { deliveryLocationService } from "../delivery/deliveryLocation.service";
import { inventoryReservationService } from "../inventory/inventoryReservation.service";
import { canadianTaxService, TaxDestination } from "../tax/canadianTax.service";
import { skuOfferService } from "../catalog/skuOffer.service";

export interface CheckoutLine {
  skuId: string;
  productId: string;
  vendorId: string;
  productName: string;
  variantName?: string;
  skuCode: string;
  productImage?: string;
  quantity: number;
  mrpCents: number;
  unitPriceCents: number;
  lineProductDiscountCents: number;
  lineTotalCents: number;
  taxCategoryId?: string;
}

export interface CheckoutBreakdown {
  currency: "CAD";
  lines: CheckoutLine[];
  subtotalCents: number;
  productDiscountCents: number;
  scratchDiscountCents: number;
  couponDiscountCents: number;
  deliveryFeeCents: number;
  /** Base delivery after postal-code fee + free-shipping threshold (before superfast). */
  standardDeliveryFeeCents: number;
  /** Configured Superfast surcharge (always returned for UI). */
  superfastDeliveryFeeCents: number;
  /** Surcharge actually applied for the selected speed (0 for standard). */
  superfastSurchargeCents: number;
  deliverySpeed: DeliverySpeed;
  platformFeeCents: number;
  handlingFeeCents: number;
  smallCartFeeCents: number;
  taxCents: number;
  totalCents: number;
  taxSnapshot: Awaited<ReturnType<typeof canadianTaxService.calculate>>;
  couponSnapshot?: {
    code: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    amountCents: number;
  };
  /** Present when softCouponFailure is set and the coupon could not be applied. */
  couponError?: string;
  scratchRewardId?: string;
  scratchRewardCode?: string;
  /** Sum of original/MRP × qty (integer cents). */
  totalMrpCents: number;
  /** Alias of subtotalCents — sum of selling × qty. */
  sellingTotalCents: number;
  /** max(0, totalMrpCents - sellingTotalCents). */
  discountOnMrpCents: number;
  /** Product MRP discount + coupon + scratch (no double-count). */
  totalSavingsCents: number;
  /** Compat dollar fields */
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
}

function computeScratchDiscountCents(
  reward: {
    discountType: "percentage" | "fixed";
    discountValue: number;
    maximumDiscountCents?: number;
    minimumOrderValueCents: number;
    status: string;
    expiresAt: Date;
  },
  subtotalAfterProductDiscount: number,
): number {
  if (reward.status !== "issued") {
    throw new BadRequestError("Scratch reward is not available");
  }
  if (reward.expiresAt.getTime() < Date.now()) {
    throw new BadRequestError("Scratch reward has expired");
  }
  if (subtotalAfterProductDiscount < reward.minimumOrderValueCents) {
    throw new BadRequestError("Order does not meet scratch reward minimum");
  }
  let amount =
    reward.discountType === "percentage"
      ? applyBps(subtotalAfterProductDiscount, reward.discountValue * 100)
      : reward.discountValue;
  if (reward.maximumDiscountCents != null) {
    amount = Math.min(amount, reward.maximumDiscountCents);
  }
  return clampNonNegativeCents(Math.min(amount, subtotalAfterProductDiscount));
}

export const checkoutPricingService = {
  /**
   * Quote checkout. Does NOT reserve or deduct inventory permanently.
   * Validates available quantity only.
   */
  async quote(input: {
    userId: string;
    couponCode?: string;
    /** When true, invalid coupons do not fail the quote — fees/tax still return. */
    softCouponFailure?: boolean;
    scratchRewardId?: string;
    shippingDestination?: TaxDestination;
    deliverySpeed?: DeliverySpeed;
    transactionDate?: Date;
  }): Promise<CheckoutBreakdown> {
    const cart = await Cart.findOne({ userId: input.userId });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestError("Your cart is empty");
    }
    const settings = await getPlatformSettings();
    const lines: CheckoutLine[] = [];

    for (const item of cart.items) {
      let skuId = item.skuId ? String(item.skuId) : "";
      if (!skuId && item.productId) {
        const resolved = await skuOfferService.resolveSkuForProductId(String(item.productId));
        if (resolved) skuId = String(resolved._id);
      }

      if (skuId) {
        const offer = await skuOfferService.getOfferBySkuId(skuId);
        if (!offer.available || offer.availableQuantity < item.quantity) {
          throw new BadRequestError(`${offer.name} does not have enough stock`);
        }
        const lineProductDiscountCents = offer.discountCents * item.quantity;
        const lineTotalCents = offer.sellingPriceCents * item.quantity;
        lines.push({
          skuId: offer.skuId,
          productId: offer.productId,
          vendorId: offer.vendorId,
          productName: offer.name,
          variantName: offer.variant,
          skuCode: offer.sku,
          productImage: offer.images[0],
          quantity: item.quantity,
          mrpCents: offer.mrpCents,
          unitPriceCents: offer.sellingPriceCents,
          lineProductDiscountCents,
          lineTotalCents,
          taxCategoryId: offer.taxCategoryId,
        });
      } else if (item.productId) {
        // Legacy product path
        const product = await Product.findById(item.productId);
        if (!product || product.isActive === false) {
          throw new BadRequestError("One or more products are no longer available");
        }
        if ((product.stock ?? 0) < item.quantity) {
          throw new BadRequestError(`${product.name} does not have enough stock`);
        }
        const unitPriceCents = dollarsToCents(product.price ?? 0);
        const mrpCents = dollarsToCents(product.compareAtPrice ?? product.price ?? 0);
        lines.push({
          skuId: "",
          productId: String(product._id),
          vendorId: String(product.vendorId),
          productName: product.name,
          skuCode: product.sku || "",
          productImage: product.thumbnail || (typeof product.images?.[0] === "string" ? (product.images[0] as unknown as string) : undefined),
          quantity: item.quantity,
          mrpCents,
          unitPriceCents,
          lineProductDiscountCents: Math.max(0, mrpCents - unitPriceCents) * item.quantity,
          lineTotalCents: unitPriceCents * item.quantity,
        });
      } else {
        throw new BadRequestError("Cart item is missing skuId");
      }
    }

    const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    const productDiscountCents = lines.reduce((s, l) => s + l.lineProductDiscountCents, 0);

    let couponDiscountCents = 0;
    let couponSnapshot: CheckoutBreakdown["couponSnapshot"];
    let couponError: string | undefined;
    if (input.couponCode) {
      try {
        const applied = await couponService.applyCents(input.couponCode, input.userId, subtotalCents);
        couponDiscountCents = applied.amountCents;
        couponSnapshot = {
          code: applied.coupon.couponCode,
          discountType: applied.coupon.discountType,
          discountValue: applied.coupon.discountValue,
          amountCents: applied.amountCents,
        };
      } catch (error) {
        if (input.softCouponFailure && error instanceof BadRequestError) {
          couponError = error.message;
        } else {
          throw error;
        }
      }
    }

    let scratchDiscountCents = 0;
    let scratchRewardId: string | undefined;
    let scratchRewardCode: string | undefined;
    if (input.scratchRewardId) {
      const reward = await UserScratchReward.findOne({
        _id: input.scratchRewardId,
        userId: input.userId,
      });
      if (!reward) throw new BadRequestError("Scratch reward not found");
      scratchDiscountCents = computeScratchDiscountCents(
        reward,
        subtotalCents - couponDiscountCents,
      );
      scratchRewardId = String(reward._id);
      scratchRewardCode = reward.code;
    }

    const afterDiscounts = clampNonNegativeCents(
      subtotalCents - couponDiscountCents - scratchDiscountCents,
    );

    let standardDeliveryFeeCents = settings.deliveryFeeCents ?? 0;
    let locationSuperfastFeeCents: number | undefined;
    if (input.shippingDestination) {
      const match = await deliveryLocationService.findMatchingLocation(input.shippingDestination);
      if (match) {
        standardDeliveryFeeCents = match.deliveryFeeCents ?? standardDeliveryFeeCents;
        if (match.superfastDeliveryFeeCents != null) {
          locationSuperfastFeeCents = match.superfastDeliveryFeeCents;
        }
      }
    }
    if (afterDiscounts >= (settings.freeShippingThresholdCents ?? 0)) {
      standardDeliveryFeeCents = 0;
    }
    const deliverySpeed: DeliverySpeed =
      input.deliverySpeed && (DELIVERY_SPEEDS as readonly string[]).includes(input.deliverySpeed)
        ? input.deliverySpeed
        : "standard";
    // Prefer the matched delivery area's Superfast surcharge; fall back to platform default.
    const superfastDeliveryFeeCents =
      locationSuperfastFeeCents ??
      settings.superfastDeliveryFeeCents ??
      DEFAULT_SUPERFAST_DELIVERY_FEE_CENTS;
    const superfastSurchargeCents = deliverySpeed === "superfast" ? superfastDeliveryFeeCents : 0;
    const deliveryFeeCents = addCents(standardDeliveryFeeCents, superfastSurchargeCents);
    const platformFeeCents = settings.platformFeeCents ?? 0;
    const handlingFeeCents = settings.handlingFeeCents ?? 0;
    let smallCartFeeCents = 0;
    if (afterDiscounts < (settings.smallCartThresholdCents ?? 0)) {
      smallCartFeeCents = settings.smallCartFeeCents ?? 0;
    }

    const feesCents = addCents(deliveryFeeCents, platformFeeCents, handlingFeeCents, smallCartFeeCents);

    // Allocate discounts across lines for tax base (proportional to line totals)
    const discountPool = couponDiscountCents + scratchDiscountCents;
    const taxLines = lines.map((line) => {
      const share =
        subtotalCents > 0 ? Math.round((line.lineTotalCents / subtotalCents) * discountPool) : 0;
      return {
        skuId: line.skuId || line.productId,
        taxCategoryId: line.taxCategoryId,
        taxableAmountCents: clampNonNegativeCents(line.lineTotalCents - share),
      };
    });

    const destination: TaxDestination = input.shippingDestination || {
      country: "Canada",
      state: "ON",
    };
    const taxSnapshot = await canadianTaxService.calculate({
      shippingDestination: destination,
      transactionDate: input.transactionDate || new Date(),
      lineItems: taxLines,
    });

    const totalCents = addCents(afterDiscounts, feesCents, taxSnapshot.totalTaxCents);
    const totalMrpCents = lines.reduce((sum, line) => sum + line.mrpCents * line.quantity, 0);
    const discountOnMrpCents = clampNonNegativeCents(totalMrpCents - subtotalCents);
    const totalSavingsCents = clampNonNegativeCents(
      discountOnMrpCents + couponDiscountCents + scratchDiscountCents,
    );

    return {
      currency: "CAD",
      lines,
      subtotalCents,
      productDiscountCents,
      scratchDiscountCents,
      couponDiscountCents,
      deliveryFeeCents,
      standardDeliveryFeeCents,
      superfastDeliveryFeeCents,
      superfastSurchargeCents,
      deliverySpeed,
      platformFeeCents,
      handlingFeeCents,
      smallCartFeeCents,
      taxCents: taxSnapshot.totalTaxCents,
      totalCents,
      totalMrpCents,
      sellingTotalCents: subtotalCents,
      discountOnMrpCents,
      totalSavingsCents,
      taxSnapshot,
      couponSnapshot,
      couponError,
      scratchRewardId,
      scratchRewardCode,
      subtotal: subtotalCents / 100,
      discount: (couponDiscountCents + scratchDiscountCents) / 100,
      shippingFee: addCents(deliveryFeeCents, smallCartFeeCents) / 100,
      tax: taxSnapshot.totalTaxCents / 100,
      total: totalCents / 100,
    };
  },

  /** Soft availability check used by cart hydration (no reservation). */
  async assertAvailable(skuId: string, quantity: number) {
    if (!skuId) return;
    const available = await inventoryReservationService.availableQuantity(skuId);
    if (available < quantity) {
      const sku = await Sku.findById(skuId);
      throw new BadRequestError(`${sku?.skuCode || "Item"} does not have enough stock`);
    }
  },
};
