import { create } from "zustand";
import type { Address } from "../types";
import { entityId } from "../types";

const KEY = "yd_delivery_preference";

export type DeliveryPreference = {
  addressId: string;
  label: string;
  city: string;
  postalCode?: string;
};

function readPreference(): DeliveryPreference | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeliveryPreference;
  } catch {
    return null;
  }
}

function persist(preference: DeliveryPreference | null) {
  if (!preference) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(preference));
}

export function formatDeliveryLabel(address: Pick<Address, "city" | "postalCode" | "addressType">) {
  const place = address.city?.trim() || address.postalCode?.trim() || "your area";
  return place;
}

interface DeliveryPreferenceState {
  preference: DeliveryPreference | null;
  setFromAddress: (address: Address) => void;
  clear: () => void;
}

export const useDeliveryPreferenceStore = create<DeliveryPreferenceState>((set) => ({
  preference: readPreference(),
  setFromAddress: (address) => {
    const next: DeliveryPreference = {
      addressId: entityId(address),
      label: formatDeliveryLabel(address),
      city: address.city,
      postalCode: address.postalCode,
    };
    persist(next);
    set({ preference: next });
  },
  clear: () => {
    persist(null);
    set({ preference: null });
  },
}));
