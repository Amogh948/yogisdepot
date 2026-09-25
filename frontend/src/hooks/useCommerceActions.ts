import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product } from "../types";
import { entityId } from "../types";
import { cartApi, wishlistApi } from "../services/api/commerce.api";
import { useAuthStore } from "../store/auth.store";
import { addGuestItem, updateGuestItem, useGuestCartStore } from "../store/guestCart.store";
import { useToastStore } from "../store/toast.store";
import { ApiError } from "../services/api/client";
import { useCart } from "./useCatalog";

export function useCommerceActions() {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();

  const cart = useCart();

  const addToCart = useMutation({
    mutationFn: async ({ product, quantity = 1 }: { product: Product; quantity?: number }) => {
      const id = entityId(product);
      if (!user) {
        addGuestItem(id, quantity);
        return;
      }
      await cartApi.add(id, quantity);
    },
    onSuccess: async () => {
      toast("Added to cart");
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update cart", "error"),
  });

  const toggleWishlist = useMutation({
    mutationFn: async ({ product, wished }: { product: Product; wished: boolean }) => {
      if (!user) throw new ApiError("Please log in to use wishlist", 401);
      const id = entityId(product);
      if (wished) await wishlistApi.remove(id);
      else await wishlistApi.add(id);
    },
    onSuccess: async (_, variables) => {
      toast(variables.wished ? "Removed from wishlist" : "Saved to wishlist");
      await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Wishlist update failed", "error"),
  });

  const setCartQuantity = useMutation({
    mutationFn: async ({ product, quantity }: { product: Product; quantity: number }) => {
      const id = entityId(product);
      const current = user
        ? cart.data?.data.items.find((item) => item.productId === id)?.quantity ?? 0
        : useGuestCartStore.getState().items.find((item) => item.productId === id)?.quantity ?? 0;
      const firstAdd = current <= 0 && quantity > 0;
      if (!user) {
        updateGuestItem(id, quantity);
        return { firstAdd };
      }
      if (quantity <= 0) {
        await cartApi.remove(id);
        return { firstAdd: false };
      }
      if (current <= 0) {
        await cartApi.add(id, quantity);
        return { firstAdd };
      }
      await cartApi.update(id, quantity);
      return { firstAdd: false };
    },
    onSuccess: async (result) => {
      if (result?.firstAdd) toast("Added to cart");
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update cart", "error"),
  });

  return { addToCart, setCartQuantity, toggleWishlist };
}
