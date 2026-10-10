import type { Product } from "../types";
import { mediaUrl } from "../types";

/** Resolve a displayable product image URL (thumbnail or first gallery image). */
export function productImageUrl(product: Product | undefined | null): string {
  if (!product) return "";
  if (product.thumbnail) return mediaUrl(product.thumbnail);
  const images = product.images;
  if (!Array.isArray(images) || images.length === 0) return "";
  const first = images[0] as unknown;
  if (typeof first === "string") return mediaUrl(first);
  if (first && typeof first === "object" && "url" in first) {
    return mediaUrl(String((first as { url?: string }).url || ""));
  }
  return "";
}
