import { BadRequestError } from "../../errors/AppError";
import { Cart } from "../../models/Cart";
import { getPlatformSettings } from "../../models/PlatformSettings";
import { Product } from "../../models/Product";
import { Sku } from "../../models/Sku";
import { UserScratchReward } from "../../models/UserScratchReward";
import { addCents, applyBps, clampNonNegativeCents, dollarsToCents } from "../../utils/money";
import { couponService } from "../coupons/coupon.service";
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
  scratchRewardId?: string;
  scratchRewardCode?: string;
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
    scratchRewardId?: string;
    shippingDestination?: TaxDestination;
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
    if (input.couponCode) {
      const applied = await couponService.applyCents(input.couponCode, input.userId, subtotalCents);
      couponDiscountCents = applied.amountCents;
      couponSnapshot = {
        code: applied.coupon.couponCode,
        discountType: applied.coupon.discountType,
        discountValue: applied.coupon.discountValue,
        amountCents: applied.amountCents,
      };
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

    let deliveryFeeCents = settings.deliveryFeeCents ?? 0;
    if (afterDiscounts >= (settings.freeShippingThresholdCents ?? 0)) {
      deliveryFeeCents = 0;
    }
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

    return {
      currency: "CAD",
      lines,
      subtotalCents,
      productDiscountCents,
      scratchDiscountCents,
      couponDiscountCents,
      deliveryFeeCents,
      platformFeeCents,
      handlingFeeCents,
      smallCartFeeCents,
      taxCents: taxSnapshot.totalTaxCents,
      totalCents,
      taxSnapshot,
      couponSnapshot,
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
