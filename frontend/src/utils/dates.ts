import { addCalendarDays, formatZonedCalendarDate, zonedParts } from "./sameDayDelivery";

/**
 * Format a future calendar date.
 * When `timeZone` is provided, uses that IANA zone (admin same-day timezone).
 * Otherwise falls back to the browser's local calendar (legacy).
 */
export function formatEstimatedDeliveryDate(
  daysFromNow: number,
  from = new Date(),
  timeZone?: string,
): string {
  const days = Math.max(1, Math.floor(daysFromNow || 5));
  if (timeZone) {
    const today = zonedParts(from, timeZone);
    return formatZonedCalendarDate(addCalendarDays(today, days), timeZone);
  }
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function returnPolicyLabel(returnWindowDays: number | undefined | null): string {
  const days = Math.max(0, Math.floor(Number(returnWindowDays ?? 0)));
  if (days <= 0) return "Non-returnable";
  return `Returnable within ${days} day${days === 1 ? "" : "s"}`;
}
