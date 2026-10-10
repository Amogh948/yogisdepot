import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type OrderSuccessAnimationProps = {
  orderNumber: string;
  orderId: string;
  deliveryNote?: string;
  /** When true, play the bike celebration; otherwise show static confirmation. */
  playCelebration: boolean;
};

function DeliveryBikeSvg() {
  return (
    <svg
      className="yd-order-bike-svg"
      viewBox="0 0 160 96"
      width="160"
      height="96"
      aria-hidden
      focusable="false"
    >
      {/* Rear wheel — outer translate preserved; inner group spins */}
      <g transform="translate(28 62)">
        <g className="yd-order-bike-wheel">
          <circle r="16" fill="none" stroke="#183C2B" strokeWidth="3" />
          <circle r="3" fill="#183C2B" />
          <path d="M0-14V14M-14 0H14M-10-10L10 10M-10 10L10-10" stroke="#287A43" strokeWidth="1.5" opacity="0.85" />
        </g>
      </g>
      {/* Front wheel */}
      <g transform="translate(118 62)">
        <g className="yd-order-bike-wheel">
          <circle r="16" fill="none" stroke="#183C2B" strokeWidth="3" />
          <circle r="3" fill="#183C2B" />
          <path d="M0-14V14M-14 0H14M-10-10L10 10M-10 10L10-10" stroke="#287A43" strokeWidth="1.5" opacity="0.85" />
        </g>
      </g>
      {/* Frame */}
      <path
        d="M28 62 L58 38 L92 38 L118 62 M58 38 L52 62 M92 38 L70 62 M52 62 H70"
        fill="none"
        stroke="#183C2B"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handlebar */}
      <path d="M118 62 L108 30 H96" fill="none" stroke="#183C2B" strokeWidth="2.5" strokeLinecap="round" />
      {/* Seat */}
      <path d="M50 34 H66" stroke="#183C2B" strokeWidth="3.5" strokeLinecap="round" />
      {/* Delivery box */}
      <g className="yd-order-bike-box">
        <rect x="68" y="14" width="34" height="24" rx="3" fill="#D85B0B" />
        <path d="M68 24 H102" stroke="#F3E7D3" strokeWidth="1.5" opacity="0.7" />
        <path d="M85 14 V38" stroke="#F3E7D3" strokeWidth="1.5" opacity="0.7" />
        <text x="85" y="30" textAnchor="middle" fill="#FAF7F1" fontSize="8" fontWeight="700" fontFamily="Manrope, sans-serif">
          YD
        </text>
      </g>
      {/* Rider */}
      <g className="yd-order-bike-rider">
        <circle cx="72" cy="18" r="7" fill="#183C2B" />
        <path
          d="M68 26 C66 34 62 42 58 48 L66 50 C70 42 74 36 78 30 Z"
          fill="#287A43"
        />
        <path d="M78 30 L92 38" stroke="#183C2B" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function OrderSuccessAnimation({
  orderNumber,
  orderId,
  deliveryNote,
  playCelebration,
}: OrderSuccessAnimationProps) {
  const titleId = useId();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const animate = playCelebration && !reduced;
  const [messageVisible, setMessageVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setMessageVisible(true);
      return;
    }
    setMessageVisible(false);
    const timer = window.setTimeout(() => setMessageVisible(true), 2200);
    return () => window.clearTimeout(timer);
  }, [animate]);

  return (
    <section
      className="yd-order-success relative overflow-hidden rounded-[16px] border border-yd-border bg-gradient-to-b from-[#EEF7F1] via-yd-bg to-yd-cream px-4 pb-8 pt-6 text-center shadow-soft sm:px-6"
      aria-labelledby={titleId}
      data-testid="order-success-celebration"
      data-celebrating={playCelebration ? "true" : "false"}
      data-reduced-motion={reduced ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {animate
          ? Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                className="yd-order-confetti"
                style={
                  {
                    "--x": `${8 + ((index * 7) % 84)}%`,
                    "--delay": `${80 + index * 90}ms`,
                    "--hue": ["#287A43", "#D85B0B", "#183C2B", "#E87516"][index % 4],
                  } as CSSProperties
                }
              />
            ))
          : null}
        <div className={`yd-order-road ${animate ? "yd-order-road--scroll" : ""}`} />
      </div>

      <div className="yd-order-bike-stage relative mx-auto h-28 w-full max-w-lg sm:h-32">
        <div className={`yd-order-bike ${animate ? "yd-order-bike--ride" : "yd-order-bike--rest"}`}>
          <DeliveryBikeSvg />
        </div>
      </div>

      <div
        className={`relative mx-auto mt-2 max-w-sm transition-all duration-500 ${
          messageVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
        }`}
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-yd-success" aria-hidden />
        <h1 id={titleId} className="mt-3 font-display text-3xl text-yd-forest sm:text-[2rem]">
          Woohoo! Your order is confirmed!
        </h1>
        <p className="mt-2 text-sm text-yd-ink/80">
          Your Yogis Depot goodies are getting ready for delivery.
        </p>
        <div className="mt-4 rounded-[12px] bg-white/80 px-4 py-3 text-left ring-1 ring-yd-border/70">
          <p className="text-sm font-semibold text-yd-ink">{orderNumber}</p>
          {deliveryNote ? <p className="mt-1 text-sm text-yd-muted">{deliveryNote}</p> : null}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to={`/orders/${orderId}`}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-yd-saffron px-5 text-sm font-bold text-white hover:bg-yd-terracotta"
          >
            View Order
          </Link>
          <Link
            to="/products"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-yd-border bg-white px-5 text-sm font-bold text-yd-forest hover:bg-yd-cream"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
