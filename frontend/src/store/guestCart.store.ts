import { create } from "zustand";

const KEY = "yd_guest_cart";

export interface GuestCartItemMeta {
  image?: string;
  name?: string;
  /** Unit price in dollars — used for guest free-delivery threshold checks. */
  price?: number;
}

export interface GuestCartItem extends GuestCartItemMeta {
  productId: string;
  quantity: number;
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
    const existing = items.find((item) => item.productId === productId);
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
    if (quantity <= 0) {
      items = items.filter((item) => item.productId !== productId);
    } else {
      const existing = items.find((item) => item.productId === productId);
      if (existing) {
        existing.quantity = quantity;
        applyMeta(existing, meta);
      } else {
        items.push({ productId, quantity, ...meta });
      }
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
