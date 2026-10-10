import { create } from "zustand";

const CELEBRATED_KEY = "yd_free_delivery_celebrated";

interface FreeDeliveryUiState {
  open: boolean;
  show: () => void;
  dismiss: () => void;
}

export function hasCelebratedFreeDeliveryUnlock(): boolean {
  try {
    return sessionStorage.getItem(CELEBRATED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFreeDeliveryUnlockCelebrated(): void {
  try {
    sessionStorage.setItem(CELEBRATED_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearFreeDeliveryUnlockCelebrated(): void {
  try {
    sessionStorage.removeItem(CELEBRATED_KEY);
  } catch {
    /* ignore */
  }
}

export const useFreeDeliveryUiStore = create<FreeDeliveryUiState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  dismiss: () => set({ open: false }),
}));
