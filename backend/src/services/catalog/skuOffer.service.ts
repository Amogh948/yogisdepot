import { Types } from "mongoose";
import { NotFoundError } from "../../errors/AppError";
import { Brand } from "../../models/Brand";
import { Inventory } from "../../models/Inventory";
import { Pricing } from "../../models/Pricing";
import { Product, ProductDocument } from "../../models/Product";
import { Sku, SkuDocument } from "../../models/Sku";
import { TaxCategory } from "../../models/TaxCategory";
import { dollarsToCents } from "../../utils/money";

export interface PublicSkuOffer {
  id: string;
  skuId: string;
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  brand?: string;
  variant?: string;
  sku: string;
  mrpCents: number;
  sellingPriceCents: number;
  discountCents: number;
  discountPercentage: number;
  /** Compat dollar fields for existing UI during rollout */
  price: number;
  compareAtPrice?: number;
  images: string[];
  available: boolean;
  availableQuantity: number;
  shortDescription?: string;
  description?: string;
  taxCategoryId?: string;
  vendorId: string;
}

function publicImages(product: ProductDocument): string[] {
  if (product.images?.length) {
    return product.images
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((i) => i.url);
  }
  const legacy = (product as ProductDocument & { legacyImages?: string[] }).legacyImages;
  if (legacy?.length) return legacy;
  // mongoose may still store string[] in images from old docs
  const raw = product.get?.("images");
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw as string[];
  if (product.thumbnail) return [product.thumbnail];
  return [];
}

async function activePricing(skuId: Types.ObjectId, at = new Date()) {
  return Pricing.findOne({
    skuId,
    isActive: true,
    effectiveFrom: { $lte: at },
    $or: [{ effectiveUntil: null }, { effectiveUntil: { $gt: at } }],
  }).sort({ effectiveFrom: -1 });
}

export const skuOfferService = {
  async resolveSkuForProductId(productId: string): Promise<SkuDocument | null> {
    return Sku.findOne({ productId, status: "active" }).sort({ createdAt: 1 });
  },

  async getOfferBySkuId(skuId: string, options?: { includeAdmin?: boolean }): Promise<PublicSkuOffer> {
    const sku = await Sku.findById(skuId);
    if (!sku || sku.status !== "active") throw new NotFoundError("SKU not available");
    return this.buildOffer(sku, options);
  },

  async buildOffer(sku: SkuDocument, options?: { includeAdmin?: boolean }): Promise<PublicSkuOffer> {
    const product = await Product.findById(sku.productId);
    if (!product) throw new NotFoundError("Product not found");
    const variant = product.variants?.find((v) => v.variantId === sku.variantId);
    const pricing = await activePricing(sku._id);
    let mrpCents = pricing?.mrpCents;
    let sellingPriceCents = pricing?.sellingPriceCents;
    if (mrpCents == null || sellingPriceCents == null) {
      // Legacy product dual-read
      sellingPriceCents = dollarsToCents(product.price ?? 0);
      mrpCents = dollarsToCents(product.compareAtPrice ?? product.price ?? 0);
    }
    const discountCents = Math.max(0, mrpCents - sellingPriceCents);
    const discountPercentage =
      mrpCents > 0 ? Math.round((discountCents / mrpCents) * 10000) / 100 : 0;

    const invAgg = await Inventory.aggregate([
      { $match: { skuId: sku._id } },
      { $group: { _id: null, available: { $sum: "$availableQuantity" } } },
    ]);
    let availableQuantity = invAgg[0]?.available ?? 0;
    if (!pricing && typeof product.stock === "number") {
      availableQuantity = product.stock;
    }

    let brandName = product.brand;
    if (product.brandId) {
      const brand = await Brand.findById(product.brandId).lean();
      brandName = brand?.name || brandName;
    }

    const offer: PublicSkuOffer = {
      id: String(product._id),
      skuId: String(sku._id),
      productId: String(product._id),
      variantId: sku.variantId,
      name: product.name,
      slug: product.slug,
      brand: brandName,
      variant: variant?.name,
      sku: sku.skuCode,
      mrpCents,
      sellingPriceCents,
      discountCents,
      discountPercentage,
      price: sellingPriceCents / 100,
      compareAtPrice: mrpCents > sellingPriceCents ? mrpCents / 100 : undefined,
      images: publicImages(product),
      available: availableQuantity > 0 && (product.status === "active" || product.isActive !== false),
      availableQuantity,
      shortDescription: product.shortDescription,
      description: product.description,
      taxCategoryId: sku.taxCategoryId ? String(sku.taxCategoryId) : undefined,
      vendorId: String(sku.vendorId),
    };

    if (options?.includeAdmin && pricing) {
      return { ...offer, costPriceCents: pricing.costPriceCents } as PublicSkuOffer & {
        costPriceCents: number;
      };
    }
    return offer;
  },

  async offersForProduct(product: ProductDocument): Promise<PublicSkuOffer[]> {
    const skus = await Sku.find({ productId: product._id, status: "active" });
    if (skus.length === 0) {
      // Legacy product without SKU stack — synthesize offer
      const mrpCents = dollarsToCents(product.compareAtPrice ?? product.price ?? 0);
      const sellingPriceCents = dollarsToCents(product.price ?? 0);
      const discountCents = Math.max(0, mrpCents - sellingPriceCents);
      return [
        {
          id: String(product._id),
          skuId: "",
          productId: String(product._id),
          variantId: "",
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          sku: product.sku || "",
          mrpCents,
          sellingPriceCents,
          discountCents,
          discountPercentage: mrpCents > 0 ? Math.round((discountCents / mrpCents) * 10000) / 100 : 0,
          price: sellingPriceCents / 100,
          compareAtPrice: mrpCents > sellingPriceCents ? mrpCents / 100 : undefined,
          images: publicImages(product),
          available: (product.stock ?? 0) > 0 && product.isActive !== false,
          availableQuantity: product.stock ?? 0,
          shortDescription: product.shortDescription,
          description: product.description,
          vendorId: String(product.vendorId),
        },
      ];
    }
    return Promise.all(skus.map((sku) => this.buildOffer(sku)));
  },

  stripAdminFields<T extends Record<string, unknown>>(doc: T): T {
    const clone = { ...doc };
    delete clone.costPrice;
    delete clone.costPriceCents;
    delete clone.purchasePriceCents;
    return clone;
  },

  async ensureTaxCategory(code = "STANDARD"): Promise<string> {
    let cat = await TaxCategory.findOne({ code });
    if (!cat) {
      cat = await TaxCategory.create({
        name: "Standard taxable",
        code,
        taxability: "TAXABLE",
        isActive: true,
      });
    }
    return String(cat._id);
  },
};
