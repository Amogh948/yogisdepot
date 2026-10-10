import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiSuccess, Cart, Product } from "../types";
import { entityId } from "../types";
import { cartApi, wishlistApi } from "../services/api/commerce.api";
import { useAuthStore } from "../store/auth.store";
import { addGuestItem, updateGuestItem, useGuestCartStore } from "../store/guestCart.store";
import { useCartUiStore } from "../store/cartUi.store";
import { useToastStore } from "../store/toast.store";
import { ApiError } from "../services/api/client";
import { productImageUrl } from "../utils/productImage";

type CartQueryData = ApiSuccess<Cart>;

function emptyCart(): Cart {
  return { id: "optimistic", items: [], subtotal: 0, itemCount: 0 };
}

function applyOptimisticCart(cart: Cart, product: Product, quantity: number): Cart {
  const id = entityId(product);
  const items = cart.items.map((item) => ({ ...item }));
  const index = items.findIndex((item) => item.productId === id);

  if (quantity <= 0) {
    if (index >= 0) items.splice(index, 1);
  } else if (index >= 0) {
    items[index] = { ...items[index], quantity, lineTotal: product.price * quantity };
  } else {
    items.push({
      productId: id,
      quantity,
      product,
      lineTotal: product.price * quantity,
      inStock: (product.stock ?? 0) > 0,
    });
  }

  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

function celebrateIfIncreased(previousQty: number, nextQty: number) {
  if (nextQty > previousQty) {
    useCartUiStore.getState().celebrateAdd();
  }
}

export function useCommerceActions() {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();

  const addToCart = useMutation({
    mutationFn: async ({ product, quantity = 1 }: { product: Product; quantity?: number }) => {
      const id = entityId(product);
      const skuId = (product as Product & { skuId?: string }).skuId;

      if (!user) {
        const previousQty = useGuestCartStore.getState().items.find((item) => item.productId === id)?.quantity ?? 0;
        celebrateIfIncreased(previousQty, previousQty + quantity);
        addGuestItem(id, quantity, { image: productImageUrl(product), name: product.name, price: product.price });
        return { guest: true as const };
      }

      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartQueryData>(["cart"]);
      const previousQty = previous?.data.items.find((item) => item.productId === id)?.quantity ?? 0;
      const nextQty = previousQty + quantity;
      queryClient.setQueryData<CartQueryData>(["cart"], {
        success: true,
        message: "Cart updated",
        data: applyOptimisticCart(previous?.data ?? emptyCart(), product, nextQty),
      });
      celebrateIfIncreased(previousQty, nextQty);

      try {
        await cartApi.add(id, quantity, skuId ? { skuId } : undefined);
        return { guest: false as const, previous };
      } catch (error) {
        queryClient.setQueryData(["cart"], previous);
        throw error;
      }
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update cart", "error"),
    onSettled: () => {
      if (user) void queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
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

      if (!user) {
        const previousQty = useGuestCartStore.getState().items.find((item) => item.productId === id)?.quantity ?? 0;
        celebrateIfIncreased(previousQty, quantity);
        updateGuestItem(id, quantity, { image: productImageUrl(product), name: product.name, price: product.price });
        return { guest: true as const };
      }

      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartQueryData>(["cart"]);
      const previousQty = previous?.data.items.find((item) => item.productId === id)?.quantity ?? 0;

      queryClient.setQueryData<CartQueryData>(["cart"], {
        success: true,
        message: "Cart updated",
        data: applyOptimisticCart(previous?.data ?? emptyCart(), product, quantity),
      });
      celebrateIfIncreased(previousQty, quantity);

      try {
        if (quantity <= 0) {
          await cartApi.remove(id);
        } else if (previousQty <= 0) {
          await cartApi.add(id, quantity);
        } else {
          await cartApi.update(id, quantity);
        }
        return { guest: false as const, previous };
      } catch (error) {
        queryClient.setQueryData(["cart"], previous);
        throw error;
      }
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : "Could not update cart", "error"),
    onSettled: () => {
      if (user) void queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  return { addToCart, setCartQuantity, toggleWishlist };
}
