/** Format a future calendar date in the user's local timezone (avoids UTC day-shift). */
export function formatEstimatedDeliveryDate(daysFromNow: number, from = new Date()): string {
  const days = Math.max(1, Math.floor(daysFromNow || 5));
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
