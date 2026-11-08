import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Truck } from "lucide-react";
import { deliveryApi } from "../../services/api/commerce.api";
import { useDeliveryPreferenceStore } from "../../store/deliveryPreference.store";
import {
  formatCountdown,
  getSameDayStatus,
  normalizePostalPrefix,
  type SameDayStatus,
} from "../../utils/sameDayDelivery";

/** Calgary / Edmonton store timezone for same-day promises. */
export const SAME_DAY_TIMEZONE = "America/Edmonton";
const SAME_DAY_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

type SameDayDeliveryBannerProps = {
  /** Compact strip for product/cart; default is home-friendly. */
  compact?: boolean;
  className?: string;
};

function useSameDayTicker(): SameDayStatus | null {
  const preference = useDeliveryPreferenceStore((s) => s.preference);
  const locations = useQuery({
    queryKey: ["delivery-locations"],
    queryFn: () => deliveryApi.locations(),
    staleTime: 60_000,
  });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const matchedArea = useMemo(() => {
    const postal = preference?.postalCode;
    const areas = locations.data?.data || [];
    if (!postal || !areas.length) return null;
    const needle = normalizePostalPrefix(postal);
    const matches = areas
      .filter((area) => {
        const prefix = normalizePostalPrefix(area.postalCodePrefix || "");
        return prefix && needle.startsWith(prefix);
      })
      .sort(
        (a, b) =>
          normalizePostalPrefix(b.postalCodePrefix || "").length -
          normalizePostalPrefix(a.postalCodePrefix || "").length,
      );
    return matches[0] || null;
  }, [locations.data, preference?.postalCode]);

  if (locations.isLoading) return null;

  // No postal selected yet — use the earliest active area cutoff as a generic storefront timer.
  if (!preference?.postalCode) {
    const areas = (locations.data?.data || []).filter((area) => area.sameDayEnabled !== false);
    const cutoff =
      areas.map((area) => area.sameDayCutoffTime).find((time) => Boolean(time)) || "16:00";
    return getSameDayStatus(
      {
        enabled: areas.length > 0,
        cutoffTime: cutoff,
        timezone: SAME_DAY_TIMEZONE,
        weekdays: SAME_DAY_WEEKDAYS,
        postalPrefixes: [],
      },
      now,
    );
  }

  if (!matchedArea) {
    return {
      enabled: true,
      sameDayAvailable: false,
      msRemaining: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      cutoffLabel: "",
      nextCutoffAt: null,
      mode: "unavailable_area",
    };
  }

  if (matchedArea.sameDayEnabled === false) {
    return {
      enabled: true,
      sameDayAvailable: false,
      msRemaining: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      cutoffLabel: matchedArea.sameDayCutoffTime || "16:00",
      nextCutoffAt: null,
      mode: "unavailable_area",
    };
  }

  return getSameDayStatus(
    {
      enabled: true,
      cutoffTime: matchedArea.sameDayCutoffTime || "16:00",
      timezone: SAME_DAY_TIMEZONE,
      weekdays: SAME_DAY_WEEKDAYS,
      postalPrefixes: [],
    },
    now,
    { postalCode: preference.postalCode },
  );
}

export function SameDayDeliveryBanner({ compact = false, className = "" }: SameDayDeliveryBannerProps) {
  const status = useSameDayTicker();
  if (!status || status.mode === "disabled") return null;

  if (status.mode === "unavailable_area") {
    return (
      <div
        className={`flex items-start gap-2 rounded-[14px] border border-yd-border bg-white px-3 py-2.5 text-sm shadow-soft ${className}`}
      >
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-yd-muted" />
        <p className="text-yd-muted">Same-day delivery is not available for your selected area.</p>
      </div>
    );
  }

  if (status.mode === "same_day") {
    return (
      <div
        className={`flex items-center gap-3 rounded-[14px] border border-yd-green/30 bg-yd-green/5 px-3 py-2.5 shadow-soft ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yd-green/15 text-yd-green">
          <Clock3 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-yd-forest">
            {compact ? "Same-day delivery" : "Order in time for same-day delivery"}
          </p>
          <p className="text-xs text-yd-muted">
            <span className="font-bold tabular-nums text-yd-green">{formatCountdown(status)}</span>
            {" left · subject to stock · ends "}
            {status.cutoffLabel}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] border border-yd-border bg-white px-3 py-2.5 shadow-soft ${className}`}
      role="status"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yd-cream text-yd-forest">
        <Truck className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-yd-ink">Order now for next-day delivery</p>
        <p className="text-xs text-yd-muted">
          Same-day cutoff ({status.cutoffLabel}) has passed
          {status.nextCutoffAt ? ` · next window opens on the next delivery day` : ""}. Subject to stock.
        </p>
      </div>
    </div>
  );
}

/** Hook for checkout / other surfaces that need the live status without rendering the banner. */
export function useSameDayDeliveryStatus() {
  return useSameDayTicker();
}
