import { useQuery } from "@tanstack/react-query";
import { productsApi, type ProductQuery } from "../services/api/products.api";
import { categoriesApi } from "../services/api/products.api";
import { cartApi, wishlistApi } from "../services/api/commerce.api";
import { useAuthStore } from "../store/auth.store";
import { useGuestCartStore } from "../store/guestCart.store";

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

export function useWishlist() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: () => wishlistApi.list(),
    enabled: Boolean(user),
  });
}
