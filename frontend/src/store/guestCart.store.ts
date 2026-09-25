import { create } from "zustand";

const KEY = "yd_guest_cart";

export interface GuestCartItem {
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

interface GuestCartState {
  items: GuestCartItem[];
  addItem: (productId: string, quantity: number) => GuestCartItem[];
  setItem: (productId: string, quantity: number) => GuestCartItem[];
  clear: () => void;
}

export const useGuestCartStore = create<GuestCartState>((set, get) => ({
  items: readGuestCart(),
  addItem: (productId, quantity) => {
    const items = get().items.map((item) => ({ ...item }));
    const existing = items.find((item) => item.productId === productId);
    if (existing) existing.quantity += quantity;
    else items.push({ productId, quantity });
    persist(items);
    set({ items });
    return items;
  },
  setItem: (productId, quantity) => {
    let items = get().items.map((item) => ({ ...item }));
    if (quantity <= 0) {
      items = items.filter((item) => item.productId !== productId);
    } else {
      const existing = items.find((item) => item.productId === productId);
      if (existing) existing.quantity = quantity;
      else items.push({ productId, quantity });
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

export function addGuestItem(productId: string, quantity: number): GuestCartItem[] {
  return useGuestCartStore.getState().addItem(productId, quantity);
}

export function updateGuestItem(productId: string, quantity: number): GuestCartItem[] {
  return useGuestCartStore.getState().setItem(productId, quantity);
}

export function guestCount(): number {
  return useGuestCartStore.getState().items.reduce((sum, item) => sum + item.quantity, 0);
}

export function clearGuestCart(): void {
  useGuestCartStore.getState().clear();
}
