import { useEffect, useState } from "react";
import { Clock3, Truck } from "lucide-react";
import { usePublicSettings } from "../../hooks/useSettings";
import { useDeliveryPreferenceStore } from "../../store/deliveryPreference.store";
import {
  formatCountdown,
  getSameDayStatus,
  type SameDayStatus,
} from "../../utils/sameDayDelivery";

type SameDayDeliveryBannerProps = {
  /** Compact strip for product/cart; default is home-friendly. */
  compact?: boolean;
  className?: string;
};

function useSameDayTicker(): SameDayStatus | null {
  const settings = usePublicSettings();
  const preference = useDeliveryPreferenceStore((s) => s.preference);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!settings.data) return null;

  return getSameDayStatus(
    {
      enabled: settings.data.sameDayDeliveryEnabled !== false,
      cutoffTime: settings.data.sameDayCutoffTime || "16:00",
      timezone: settings.data.sameDayTimezone || "America/Edmonton",
      weekdays: settings.data.sameDayWeekdays || [1, 2, 3, 4, 5, 6],
      postalPrefixes: settings.data.sameDayPostalPrefixes || [],
    },
    now,
    { postalCode: preference?.postalCode },
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
          {status.nextCutoffAt
            ? ` · next window opens on the next delivery day`
            : ""}
          . Subject to stock.
        </p>
      </div>
    </div>
  );
}

/** Hook for checkout / other surfaces that need the live status without rendering the banner. */
export function useSameDayDeliveryStatus() {
  return useSameDayTicker();
}
