import { useQuery } from "@tanstack/react-query";
import { productsApi, type ProductQuery } from "../services/api/products.api";
import { categoriesApi } from "../services/api/products.api";
import { cartApi, wishlistApi } from "../services/api/commerce.api";
import { useAuthStore } from "../store/auth.store";
import { useGuestCartStore } from "../store/guestCart.store";
import { productImageUrl } from "../utils/productImage";

export function useProducts(params: ProductQuery) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => productsApi.list(params),
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: () => productsApi.bySlug(slug),
    enabled: Boolean(slug),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.tree(),
  });
}

export function useCart() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => cartApi.get(),
    enabled: Boolean(user),
  });
}

export function useCartQuantity(productId: string): number {
  const user = useAuthStore((s) => s.user);
  const cart = useCart();
  const guestItems = useGuestCartStore((s) => s.items);
  if (!productId) return 0;
  if (user) {
    return cart.data?.data.items.find((item) => item.productId === productId)?.quantity ?? 0;
  }
  return guestItems.find((item) => item.productId === productId)?.quantity ?? 0;
}

export function useCartItemCount(): number {
  const user = useAuthStore((s) => s.user);
  const cart = useCart();
  const guestItems = useGuestCartStore((s) => s.items);
  if (user) return cart.data?.data.itemCount ?? 0;
  return guestItems.reduce((sum, item) => sum + item.quantity, 0);
}

export interface ViewCartSummary {
  /** False while auth/cart hydration would risk a false empty or stale flash. */
  ready: boolean;
  itemCount: number;
  /** Up to 3 product image URLs for overlapping thumbnails. */
  thumbnails: string[];
  subtotal: number | null;
}

/** Cart merchandise subtotal for free-delivery and summary UI (logged-in API or guest store). */
export function useCartSubtotal(): { ready: boolean; subtotal: number } {
  const user = useAuthStore((s) => s.user);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const cart = useCart();
  const guestItems = useGuestCartStore((s) => s.items);

  if (!bootstrapped) return { ready: false, subtotal: 0 };

  if (user) {
    if (cart.isLoading && !cart.data) return { ready: false, subtotal: 0 };
    return { ready: true, subtotal: cart.data?.data.subtotal ?? 0 };
  }

  return {
    ready: true,
    subtotal: guestItems.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0),
  };
}

/** Canonical cart summary for the global View Cart bar (logged-in API cart or guest store). */
export function useViewCartSummary(): ViewCartSummary {
  const user = useAuthStore((s) => s.user);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const cart = useCart();
  const guestItems = useGuestCartStore((s) => s.items);

  if (!bootstrapped) {
    return { ready: false, itemCount: 0, thumbnails: [], subtotal: null };
  }

  if (user) {
    if (cart.isLoading && !cart.data) {
      return { ready: false, itemCount: 0, thumbnails: [], subtotal: null };
    }
    const data = cart.data?.data;
    const items = data?.items ?? [];
    return {
      ready: true,
      itemCount: data?.itemCount ?? 0,
      thumbnails: items
        .map((item) => productImageUrl(item.product))
        .filter(Boolean)
        .slice(0, 3),
      subtotal: data?.subtotal ?? null,
    };
  }

  return {
    ready: true,
    itemCount: guestItems.reduce((sum, item) => sum + item.quantity, 0),
    thumbnails: guestItems.map((item) => item.image || "").filter(Boolean).slice(0, 3),
    subtotal: null,
  };
}

export function useWishlist() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: () => wishlistApi.list(),
    enabled: Boolean(user),
  });
}
