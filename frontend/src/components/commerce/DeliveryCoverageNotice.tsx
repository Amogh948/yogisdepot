import { useDeliveryCoverage } from "../../hooks/useDeliveryCoverage";
import type { CoveragePlace } from "../../utils/deliveryCoverage";

export function DeliveryCoverageNotice({
  className = "",
  place,
}: {
  className?: string;
  place?: CoveragePlace | null;
}) {
  const { message, orderingBlocked } = useDeliveryCoverage(place);
  if (!orderingBlocked || !message) return null;

  return (
    <p
      role="alert"
      className={`border border-yd-saffron/40 bg-saffron-50 px-4 py-2.5 text-sm font-medium leading-snug text-yd-ink ${className}`}
    >
      {message}
    </p>
  );
}
