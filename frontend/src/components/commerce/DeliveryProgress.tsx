import { useFreeDeliveryThreshold } from "../../hooks/useSettings";
import { formatCad } from "../../utils/money";

export function DeliveryProgress({ subtotal }: { subtotal: number }) {
  const { ready, threshold } = useFreeDeliveryThreshold();
  if (!ready) return null;

  // Threshold 0 → free delivery is always unlocked (admin-configured).
  if (threshold <= 0) {
    return (
      <div className="rounded-card border border-yd-border bg-white p-4">
        <p className="text-sm font-semibold text-yd-ink">You&apos;ve unlocked free delivery</p>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-yd-cream">
          <div className="h-full w-full rounded-full bg-yd-green" />
        </div>
        <p className="mt-1.5 text-xs text-yd-muted">Free delivery on all orders</p>
      </div>
    );
  }

  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));
  const free = remaining === 0;

  return (
    <div className="rounded-card border border-yd-border bg-white p-4">
      <p className="text-sm font-semibold text-yd-ink">
        {free ? "You've unlocked free delivery" : `You're ${formatCad(remaining)} away from free delivery`}
      </p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-yd-cream">
        <div className="h-full rounded-full bg-yd-green transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-yd-muted">Free delivery on orders over {formatCad(threshold)}</p>
    </div>
  );
}
