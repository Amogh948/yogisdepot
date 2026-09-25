import { create } from "zustand";
import type { User } from "../types";
import { authApi } from "../services/api/auth.api";
import { getGuestCart, clearGuestCart } from "./guestCart.store";

interface AuthState {
  user: User | null;
  loading: boolean;
  bootstrapped: boolean;
  setUser: (user: User | null) => void;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  bootstrapped: false,
  setUser: (user) => set({ user }),
  bootstrap: async () => {
    try {
      const result = await authApi.me();
      set({ user: result.data, bootstrapped: true });
    } catch {
      set({ user: null, bootstrapped: true });
    }
  },
  login: async (email, password) => {
    const guestCart = getGuestCart();
    const result = await authApi.login({ email, password, guestCart: guestCart.length ? guestCart : undefined });
    clearGuestCart();
    set({ user: result.data });
    return result.data;
  },
  logout: async () => {
    await authApi.logout();
    set({ user: null });
  },
}));
