import {
  getSameDayStatus,
  resolveEstimatedDeliveryLabel,
  type SameDayConfig,
} from "../../utils/sameDayDelivery";

/** Estimated delivery date for an order, using the placement time and the same-day cutoff. */
export function estimatedDeliveryLabel(input: {
  placedAt: Date;
  postalCode?: string;
  config: SameDayConfig;
  fallbackDays?: number;
}): string {
  const status = getSameDayStatus(input.config, input.placedAt, {
    postalCode: input.postalCode,
  });
  return resolveEstimatedDeliveryLabel({
    status,
    timeZone: input.config.timezone || "America/Edmonton",
    fallbackDaysFromNow: input.fallbackDays ?? 5,
    now: input.placedAt,
  });
}
