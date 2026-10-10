import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Tag } from "lucide-react";
import { couponsApi, type EligibleCoupon } from "../../services/api/commerce.api";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Overlay";
import { formatCadFromCents } from "../../utils/money";
import { ApiError } from "../../services/api/client";
import { useToastStore } from "../../store/toast.store";

function CouponCard({
  coupon,
  appliedCode,
  busyCode,
  onApply,
  onRemove,
}: {
  coupon: EligibleCoupon;
  appliedCode: string;
  busyCode: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const isApplied = appliedCode === coupon.code;
  const busy = busyCode === coupon.code || (isApplied && busyCode === appliedCode);
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-yd-border bg-white p-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yd-cream text-yd-forest">
        <Tag className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold tracking-wide text-yd-ink">{coupon.code}</p>
        <p className="text-sm text-yd-ink">
          {coupon.isApplicable || isApplied
            ? `Extra ${formatCadFromCents(coupon.discountAmountCents)} OFF`
            : coupon.description}
        </p>
        <p className="mt-0.5 text-xs text-yd-muted">
          {coupon.isApplicable || isApplied ? coupon.description : coupon.reason || "Not applicable"}
        </p>
      </div>
      {isApplied ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={onRemove}>
          {busy ? "…" : "Remove"}
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={!coupon.isApplicable || Boolean(busyCode)} onClick={() => onApply(coupon.code)}>
          {busy ? "…" : "Apply"}
        </Button>
      )}
    </article>
  );
}

export function CheckoutCouponsSection({
  appliedCoupon,
  onApply,
  onRemove,
}: {
  appliedCoupon: string;
  onApply: (code: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const toast = useToastStore((s) => s.push);
  const [expanded, setExpanded] = useState(true);
  const [viewAll, setViewAll] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const eligible = useQuery({
    queryKey: ["coupons-eligible"],
    queryFn: () => couponsApi.eligible(),
  });

  const offers = eligible.data?.data || [];
  const applicable = useMemo(() => offers.filter((o) => o.isApplicable), [offers]);
  const bestSaveCents = applicable[0]?.discountAmountCents ?? 0;

  const apply = async (code: string) => {
    setBusyCode(code);
    try {
      await onApply(code);
      toast(`${code} applied`);
      await eligible.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not apply coupon", "error");
    } finally {
      setBusyCode(null);
    }
  };

  const remove = async () => {
    setBusyCode(appliedCoupon || "remove");
    try {
      await onRemove();
      toast("Coupon removed", "info");
      await eligible.refetch();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not remove coupon", "error");
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl text-yd-forest">Coupons & Offers</h2>
        <button type="button" className="text-sm font-semibold text-yd-green" onClick={() => setViewAll(true)}>
          View All Offers
        </button>
      </div>

      <button
        type="button"
        className="flex w-full items-start gap-3 rounded-2xl border border-yd-border bg-white p-3 text-left shadow-soft"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yd-saffron/15 text-yd-saffron">
          <Tag className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-yd-green">
            {bestSaveCents > 0 ? `Save up to ${formatCadFromCents(bestSaveCents)}` : "Coupons & offers"}
          </span>
          <span className="text-xs text-yd-muted">
            {offers.length} Coupon{offers.length === 1 ? "" : "s"} & Offer{offers.length === 1 ? "" : "s"} Available
          </span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-yd-muted transition ${expanded ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {expanded ? (
        <div className="space-y-2">
          {(applicable.length ? applicable : offers).slice(0, 3).map((coupon) => (
            <CouponCard
              key={coupon.code}
              coupon={coupon}
              appliedCode={appliedCoupon}
              busyCode={busyCode}
              onApply={apply}
              onRemove={remove}
            />
          ))}
          {!offers.length && !eligible.isLoading ? (
            <p className="text-sm text-yd-muted">No coupons available right now.</p>
          ) : null}
        </div>
      ) : null}

      <Modal open={viewAll} onClose={() => setViewAll(false)} title="All coupons & offers">
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {offers.map((coupon) => (
            <CouponCard
              key={coupon.code}
              coupon={coupon}
              appliedCode={appliedCoupon}
              busyCode={busyCode}
              onApply={async (code) => {
                await apply(code);
                setViewAll(false);
              }}
              onRemove={async () => {
                await remove();
                setViewAll(false);
              }}
            />
          ))}
        </div>
      </Modal>
    </section>
  );
}

export function SavingsBanner({ totalSavingsCents }: { totalSavingsCents: number }) {
  if (totalSavingsCents <= 0) return null;
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl bg-yd-green/10 px-3 py-2.5 text-sm font-semibold text-yd-green">
      <Tag className="h-4 w-4 shrink-0" aria-hidden />
      <p>
        You&apos;re saving <span className="underline">{formatCadFromCents(totalSavingsCents)}</span> on this order
      </p>
    </div>
  );
}
