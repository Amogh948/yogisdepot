import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "../services/api/client";

export type PublicSettings = {
  siteName?: string;
  currency?: string;
  supportEmail?: string;
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
