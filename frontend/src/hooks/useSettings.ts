import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../services/api/client";

export type PublicSettings = {
  siteName?: string;
  currency?: string;
  supportEmail?: string;
  /** Stock 1..this → yellow "{n} available" on PDP. */
  lowStockDisplayThreshold?: number;
  /** Stock above this → green "In stock" on PDP. */
  inStockDisplayThreshold?: number;
  /** Free standard delivery when cart merchandise reaches this (cents). 0 = always unlocked. */
  freeShippingThresholdCents?: number;
};

export function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await unwrap<PublicSettings>(api.get("/settings"))).data,
    staleTime: 60_000,
  });
}

/** Free-delivery threshold in dollars from admin settings. 0 = always unlocked. */
export function useFreeDeliveryThreshold(): { ready: boolean; threshold: number } {
  const settings = usePublicSettings();
  if (!settings.isSuccess) return { ready: false, threshold: 0 };
  const cents = settings.data?.freeShippingThresholdCents;
  if (typeof cents === "number" && Number.isFinite(cents) && cents >= 0) {
    return { ready: true, threshold: cents / 100 };
  }
  return { ready: true, threshold: 75 };
}

export function useLocationHint(enabled: boolean) {
  return useQuery({
    queryKey: ["location-hint"],
    queryFn: async () =>
      (await unwrap<{ city: string | null; region: string | null; postalCode: string | null }>(api.get("/settings/location-hint"))).data,
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export function useCurrencyCode() {
  const settings = usePublicSettings();
  return (settings.data?.currency || "CAD").toUpperCase();
}
