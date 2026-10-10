import { create } from "zustand";

export interface CartCelebrationBurst {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

interface CartUiState {
  /** Increments on each successful local add/increase to drive header cart pop. */
  bump: number;
  /** Active particle bursts (capped; oldest dropped under rapid taps). */
  bursts: CartCelebrationBurst[];
  /** Compact success confirmation; replaced on each celebration to avoid stacking. */
  confirmation: { id: number; message: string } | null;
  triggerBump: () => void;
  celebrateAdd: (origin?: { x: number; y: number }) => void;
  clearBurst: (id: number) => void;
  clearConfirmation: (id: number) => void;
}

const MAX_BURSTS = 2;
let nextBurstId = 1;
let nextConfirmId = 1;

/** Last pointer/focus origin for celebrating without wiring every button. */
let lastOrigin = { x: 0, y: 0, t: 0 };

export function rememberCartPointer(x: number, y: number) {
  lastOrigin = { x, y, t: Date.now() };
}

export function resolveCelebrationOrigin(explicit?: { x: number; y: number }): { x: number; y: number } {
  if (explicit) return explicit;
  if (Date.now() - lastOrigin.t < 1500 && (lastOrigin.x || lastOrigin.y)) {
    return { x: lastOrigin.x, y: lastOrigin.y };
  }
  if (typeof document !== "undefined") {
    const el = document.activeElement;
    if (el instanceof HTMLElement) {
      const rect = el.getBoundingClientRect();
      if (rect.width || rect.height) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
    }
  }
  if (typeof window !== "undefined") {
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
  }
  return { x: 0, y: 0 };
}

export const useCartUiStore = create<CartUiState>((set) => ({
  bump: 0,
  bursts: [],
  confirmation: null,
  triggerBump: () => set((state) => ({ bump: state.bump + 1 })),
  celebrateAdd: (origin) => {
    const point = resolveCelebrationOrigin(origin);
    rememberCartPointer(point.x, point.y);
    const burstId = nextBurstId++;
    const confirmId = nextConfirmId++;
    set((state) => ({
      bump: state.bump + 1,
      bursts: [...state.bursts, { id: burstId, x: point.x, y: point.y, createdAt: Date.now() }].slice(-MAX_BURSTS),
      confirmation: { id: confirmId, message: "Added to cart!" },
    }));
  },
  clearBurst: (id) => set((state) => ({ bursts: state.bursts.filter((burst) => burst.id !== id) })),
  clearConfirmation: (id) =>
    set((state) => (state.confirmation?.id === id ? { confirmation: null } : state)),
}));
