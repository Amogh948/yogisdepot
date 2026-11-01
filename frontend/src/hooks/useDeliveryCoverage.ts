import { useQuery } from "@tanstack/react-query";
import { deliveryApi } from "../services/api/commerce.api";
import { useDeliveryPreferenceStore } from "../store/deliveryPreference.store";
import { assessDeliveryCoverage, type CoveragePlace, type CoverageStatus } from "../utils/deliveryCoverage";

export function useDeliveryCoverage(place?: CoveragePlace | null) {
  const preference = useDeliveryPreferenceStore((s) => s.preference);
  const subject = place === undefined ? preference : place;
  const locations = useQuery({
    queryKey: ["delivery-locations"],
    queryFn: () => deliveryApi.locations(),
    staleTime: 60_000,
  });

  if (!subject || locations.isLoading || locations.isError) {
    return { status: "unknown" as CoverageStatus, message: null, orderingBlocked: false };
  }

  const result = assessDeliveryCoverage(subject, locations.data?.data || []);
  return {
    ...result,
    orderingBlocked: result.status === "unavailable" || result.status === "needs-postal",
  };
}
