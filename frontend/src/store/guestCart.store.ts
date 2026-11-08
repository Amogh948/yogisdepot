import { create } from "zustand";

const KEY = "yd_guest_cart";

export interface GuestCartItemMeta {
  image?: string;
  name?: string;
  /** Unit price in dollars — used for guest free-delivery threshold checks. */
  price?: number;
  parentProductId?: string;
  /** Copied from parent product when this is a standalone kit line. */
  addChildPricesToParent?: boolean;
}

export interface GuestCartItem extends GuestCartItemMeta {
  productId: string;
  quantity: number;
}

export interface GuestChildLine {
  productId: string;
  quantity: number;
  name?: string;
  price?: number;
  image?: string;
}

function readGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: GuestCartItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function applyMeta(item: GuestCartItem, meta?: GuestCartItemMeta) {
  if (!meta) return;
  if (meta.image) item.image = meta.image;
  if (meta.name) item.name = meta.name;
  if (typeof meta.price === "number" && Number.isFinite(meta.price)) item.price = meta.price;
  if (meta.parentProductId) item.parentProductId = meta.parentProductId;
  if (typeof meta.addChildPricesToParent === "boolean") {
    item.addChildPricesToParent = meta.addChildPricesToParent;
  }
}

interface GuestCartState {
  items: GuestCartItem[];
  addItem: (productId: string, quantity: number, meta?: GuestCartItemMeta) => GuestCartItem[];
  setItem: (productId: string, quantity: number, meta?: GuestCartItemMeta) => GuestCartItem[];
  clear: () => void;
}

export const useGuestCartStore = create<GuestCartState>((set, get) => ({
  items: readGuestCart(),
  addItem: (productId, quantity, meta) => {
    const items = get().items.map((item) => ({ ...item }));
    const parentProductId = meta?.parentProductId;
    const existing = items.find(
      (item) => item.productId === productId && (item.parentProductId || "") === (parentProductId || ""),
    );
    if (existing) {
      existing.quantity += quantity;
      applyMeta(existing, meta);
    } else {
      items.push({ productId, quantity, ...meta });
    }
    persist(items);
    set({ items });
    return items;
  },
  setItem: (productId, quantity, meta) => {
    let items = get().items.map((item) => ({ ...item }));
    const standalone = items.find((item) => item.productId === productId && !item.parentProductId);
    const lockedOnly = items.some((item) => item.productId === productId && item.parentProductId);
    if (!standalone && lockedOnly) return items;
    if (quantity <= 0) {
      items = items.filter((item) => item.parentProductId !== productId && !(item.productId === productId && !item.parentProductId));
    } else if (standalone) {
      standalone.quantity = quantity;
      applyMeta(standalone, meta);
    } else {
      items.push({ productId, quantity, ...meta });
    }
    persist(items);
    set({ items });
    return items;
  },
  clear: () => {
    localStorage.removeItem(KEY);
    set({ items: [] });
  },
}));

/** Replace included lines so they match the parent quantity. */
export function syncGuestChildren(parentId: string, parentQty: number, children: GuestChildLine[]): void {
  const items = useGuestCartStore
    .getState()
    .items.filter((item) => item.parentProductId !== parentId)
    .map((item) => ({ ...item }));
  if (parentQty > 0) {
    for (const child of children) {
      const per = Math.max(1, Math.floor(child.quantity) || 1);
      items.push({
        productId: child.productId,
        quantity: parentQty * per,
        parentProductId: parentId,
        name: child.name,
        price: child.price,
        image: child.image,
      });
    }
  }
  setGuestCart(items);
}

export function getGuestCart(): GuestCartItem[] {
  return useGuestCartStore.getState().items;
}

export function setGuestCart(items: GuestCartItem[]): void {
  persist(items);
  useGuestCartStore.setState({ items: items.map((item) => ({ ...item })) });
}

export function addGuestItem(productId: string, quantity: number, meta?: GuestCartItemMeta): GuestCartItem[] {
  return useGuestCartStore.getState().addItem(productId, quantity, meta);
}

export function updateGuestItem(productId: string, quantity: number, meta?: GuestCartItemMeta): GuestCartItem[] {
  return useGuestCartStore.getState().setItem(productId, quantity, meta);
}

export function guestCount(): number {
  return useGuestCartStore.getState().items.reduce((sum, item) => sum + item.quantity, 0);
}

export function clearGuestCart(): void {
  useGuestCartStore.getState().clear();
}
