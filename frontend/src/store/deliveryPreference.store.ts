import { create } from "zustand";
import type { Address } from "../types";
import { entityId } from "../types";

const KEY = "yd_delivery_preference";

export type DeliveryPreference = {
  addressId: string;
  label: string;
  city: string;
  postalCode?: string;
  /** address = saved address, manual = typed, ip = network hint, geo = device location. */
  source?: "address" | "manual" | "ip" | "geo" | "fallback";
};

function readPreference(): DeliveryPreference | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const preference = JSON.parse(raw) as DeliveryPreference;
    if (preference.source === "fallback") {
      localStorage.removeItem(KEY);
      return null;
    }
    return preference;
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
  setPlace: (place: { label: string; city: string; postalCode?: string; source: "manual" | "ip" | "geo" }) => void;
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
      source: "address",
    };
    persist(next);
    set({ preference: next });
  },
  setPlace: (place) => {
    const city = place.city.trim();
    const next: DeliveryPreference = {
      addressId: place.source,
      label: place.label.trim() || city,
      city,
      postalCode: place.postalCode?.trim() || undefined,
      source: place.source,
    };
    persist(next);
    set({ preference: next });
  },
  clear: () => {
    persist(null);
    set({ preference: null });
  },
}));
