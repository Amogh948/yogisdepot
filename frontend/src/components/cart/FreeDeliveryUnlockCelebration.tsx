import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Truck } from "lucide-react";
import { FREE_DELIVERY_THRESHOLD } from "../../content/navigation";
import { useCartSubtotal } from "../../hooks/useCatalog";
import {
  clearFreeDeliveryUnlockCelebrated,
  hasCelebratedFreeDeliveryUnlock,
  markFreeDeliveryUnlockCelebrated,
  useFreeDeliveryUiStore,
} from "../../store/freeDeliveryUi.store";
import { formatCad } from "../../utils/money";

const AUTO_DISMISS_MS = 2800;
const PARTICLE_COUNT = 18;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Watches cart subtotal globally and opens the celebration once per unlock cycle. */
export function FreeDeliveryUnlockWatcher() {
  const { ready, subtotal } = useCartSubtotal();
  const show = useFreeDeliveryUiStore((s) => s.show);

  useEffect(() => {
    if (!ready) return;

    const unlocked = subtotal >= FREE_DELIVERY_THRESHOLD;
    if (!unlocked) {
      clearFreeDeliveryUnlockCelebrated();
      return;
    }

    if (hasCelebratedFreeDeliveryUnlock()) return;

    markFreeDeliveryUnlockCelebrated();
    show();
  }, [ready, subtotal, show]);

  return null;
}

export function FreeDeliveryUnlockCelebration() {
  const open = useFreeDeliveryUiStore((s) => s.open);
  const dismiss = useFreeDeliveryUiStore((s) => s.dismiss);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const reduced = prefersReducedMotion();
  const particles = useMemo(() => {
    if (reduced || !open) return [];
    return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
      const angle = (Math.PI * 2 * index) / PARTICLE_COUNT;
      const distance = 90 + (index % 5) * 28;
      return {
        key: index,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance * 0.75,
        delay: (index % 6) * 30,
        color: ["#287A43", "#183C2B", "#D85B0B", "#E87516", "#F3E7D3"][index % 5],
        size: 6 + (index % 4),
      };
    });
  }, [open, reduced]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismiss]);

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-yd-ink/45 px-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={dismiss}
    >
      <div
        className="yd-free-delivery-card relative w-full max-w-md rounded-[28px] bg-white px-6 py-10 text-center shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        {!reduced ? (
          <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
            {particles.map((particle) => (
              <span
                key={particle.key}
                className="yd-free-delivery-particle absolute left-1/2 top-1/2 rounded-full"
                style={
                  {
                    "--dx": `${particle.dx}px`,
                    "--dy": `${particle.dy}px`,
                    "--delay": `${particle.delay}ms`,
                    width: particle.size,
                    height: particle.size,
                    marginLeft: -particle.size / 2,
                    marginTop: -particle.size / 2,
                    backgroundColor: particle.color,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-yd-green/10 text-yd-green">
          <Truck className="h-10 w-10" strokeWidth={1.75} aria-hidden />
        </div>
        <p id={titleId} className="relative font-display text-3xl leading-tight text-yd-forest sm:text-4xl" aria-live="assertive">
          Yay! You have unlocked free delivery.
        </p>
        <p className="relative mt-3 text-sm text-yd-muted">Free delivery on orders over {formatCad(FREE_DELIVERY_THRESHOLD)}</p>
        <button
          type="button"
          className="relative mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-yd-green px-6 text-sm font-bold text-white transition hover:bg-yd-green-dark active:scale-[0.98]"
          onClick={dismiss}
        >
          Keep shopping
        </button>
      </div>
    </div>,
    document.body,
  );
}
