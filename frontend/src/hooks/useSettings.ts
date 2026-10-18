import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../services/api/client";

export type PublicSettings = {
  siteName?: string;
  currency?: string;
  supportEmail?: string;
  sameDayDeliveryEnabled?: boolean;
  sameDayCutoffTime?: string;
  sameDayTimezone?: string;
  sameDayWeekdays?: number[];
  sameDayPostalPrefixes?: string[];
  /** Stock 1..this → yellow "{n} available" on PDP. */
  lowStockDisplayThreshold?: number;
  /** Stock above this → green "In stock" on PDP. */
  inStockDisplayThreshold?: number;
};

export function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => (await unwrap<PublicSettings>(api.get("/settings"))).data,
    staleTime: 60_000,
  });
}

export function useCurrencyCode() {
  const settings = usePublicSettings();
  return (settings.data?.currency || "CAD").toUpperCase();
}
