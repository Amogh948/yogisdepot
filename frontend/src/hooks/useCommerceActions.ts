import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ApiSuccess, Cart, Product } from "../types";
import { entityId } from "../types";
import { cartApi, wishlistApi } from "../services/api/commerce.api";
import { useAuthStore } from "../store/auth.store";
import { addGuestItem, updateGuestItem, useGuestCartStore } from "../store/guestCart.store";
import { useCartUiStore } from "../store/cartUi.store";
import { useToastStore } from "../store/toast.store";
import { ApiError } from "../services/api/client";
import { productImageUrl } from "../utils/productImage";
import { applyOptimisticAdd, applyOptimisticCart, emptyCart } from "../utils/cartOptimistic";

type CartQueryData = ApiSuccess<Cart>;

const QTY_DEBOUNCE_MS = 320;

type QtyPending = {
  product: Product;
  quantity: number;
  timer: ReturnType<typeof setTimeout>;
  /** Cart snapshot before the first change in this debounce burst. */
  rollback: CartQueryData | undefined;
};

/** Per-product debounced quantity sync queue (module-level so rapid +/- coalesce). */
const qtyQueue = new Map<string, QtyPending>();

function celebrateIfIncreased(previousQty: number, nextQty: number) {
  if (nextQty > previousQty) {
    useCartUiStore.getState().celebrateAdd();
  }
}

function writeOptimistic(queryClient: QueryClient, cart: Cart) {
  queryClient.setQueryData<CartQueryData>(["cart"], {
    success: true,
    message: "Cart updated",
    data: cart,
  });
}

async function flushQuantity(
  productId: string,
  queryClient: QueryClient,
  onError: (error: unknown) => void,
) {
  const pending = qtyQueue.get(productId);
  if (!pending) return;
  qtyQueue.delete(productId);

  const { product, quantity, rollback } = pending;
  const id = entityId(product);
  const previousQty = rollback?.data.items.find((item) => item.productId === id)?.quantity ?? 0;

  try {
    let result: CartQueryData;
    if (quantity <= 0) {
      result = await cartApi.remove(id);
    } else if (previousQty <= 0) {
      const skuId = (product as Product & { skuId?: string }).skuId;
      result = await cartApi.add(id, quantity, skuId ? { skuId } : undefined);
    } else {
      result = await cartApi.update(id, quantity);
    }
    // Prefer server cart, but don't clobber a newer optimistic edit queued after this flush started.
    if (!qtyQueue.has(productId)) {
      queryClient.setQueryData(["cart"], result);
    }
  } catch (error) {
    if (!qtyQueue.has(productId)) {
      queryClient.setQueryData(["cart"], rollback);
    }
    onError(error);
  }
}

function scheduleQuantitySync(
  product: Product,
  quantity: number,
  queryClient: QueryClient,
  onError: (error: unknown) => void,
  /** Snapshot taken before the first optimistic write in this burst. */
  rollback: CartQueryData | undefined,
) {
  const id = entityId(product);
  const existing = qtyQueue.get(id);
  if (existing) {
    clearTimeout(existing.timer);
    existing.product = product;
    existing.quantity = quantity;
    existing.timer = setTimeout(() => {
      void flushQuantity(id, queryClient, onError);
    }, QTY_DEBOUNCE_MS);
    return;
  }

  const timer = setTimeout(() => {
    void flushQuantity(id, queryClient, onError);
  }, QTY_DEBOUNCE_MS);
  qtyQueue.set(id, { product, quantity, timer, rollback });
}

export function useCommerceActions() {
  const user = useAuthStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const queryClient = useQueryClient();

  const reportCartError = (error: unknown) => {
    toast(error instanceof ApiError ? error.message : "Could not update cart", "error");
  };

  const addToCart = useMutation({
    mutationFn: async ({ product, quantity = 1 }: { product: Product; quantity?: number }) => {
      const id = entityId(product);
      const skuId = (product as Product & { skuId?: string }).skuId;

      if (!user) {
        const previousQty = useGuestCartStore.getState().items.find((item) => item.productId === id)?.quantity ?? 0;
        celebrateIfIncreased(previousQty, previousQty + quantity);
        addGuestItem(id, quantity, {
          image: productImageUrl(product),
          name: product.name,
          price: product.price,
        });
        return { guest: true as const };
      }

      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartQueryData>(["cart"]);
      const previousQty = previous?.data.items.find((item) => item.productId === id)?.quantity ?? 0;
      writeOptimistic(
        queryClient,
        applyOptimisticAdd(previous?.data ?? emptyCart(), product, quantity),
      );
      celebrateIfIncreased(previousQty, previousQty + quantity);

      try {
        const result = await cartApi.add(id, quantity, skuId ? { skuId } : undefined);
        // Don't overwrite if a debounced qty edit is in flight for this product.
        if (!qtyQueue.has(id)) {
          queryClient.setQueryData(["cart"], result);
        }
        return { guest: false as const };
      } catch (error) {
        queryClient.setQueryData(["cart"], previous);
        throw error;
      }
    },
    onError: reportCartError,
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
        updateGuestItem(id, quantity, {
          image: productImageUrl(product),
          name: product.name,
          price: product.price,
        });
        return { guest: true as const };
      }

      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartQueryData>(["cart"]);
      const previousQty = previous?.data.items.find((item) => item.productId === id)?.quantity ?? 0;

      // Instant UI — then coalesce rapid +/- into one backend call.
      writeOptimistic(queryClient, applyOptimisticCart(previous?.data ?? emptyCart(), product, quantity));
      celebrateIfIncreased(previousQty, quantity);
      scheduleQuantitySync(product, quantity, queryClient, reportCartError, previous);

      return { guest: false as const };
    },
    onError: reportCartError,
  });

  return { addToCart, setCartQuantity, toggleWishlist };
}
