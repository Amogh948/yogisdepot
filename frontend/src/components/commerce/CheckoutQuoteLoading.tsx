/**
 * Full-screen checkout wait state while cart sync + tax/quote settle.
 * Reuses the order-success bike artwork with a looping ride.
 */
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
      <g transform="translate(28 62)">
        <g className="yd-order-bike-wheel">
          <circle r="16" fill="none" stroke="#183C2B" strokeWidth="3" />
          <circle r="3" fill="#183C2B" />
          <path
            d="M0-14V14M-14 0H14M-10-10L10 10M-10 10L10-10"
            stroke="#287A43"
            strokeWidth="1.5"
            opacity="0.85"
          />
        </g>
      </g>
      <g transform="translate(118 62)">
        <g className="yd-order-bike-wheel">
          <circle r="16" fill="none" stroke="#183C2B" strokeWidth="3" />
          <circle r="3" fill="#183C2B" />
          <path
            d="M0-14V14M-14 0H14M-10-10L10 10M-10 10L10-10"
            stroke="#287A43"
            strokeWidth="1.5"
            opacity="0.85"
          />
        </g>
      </g>
      <path
        d="M28 62 L58 38 L92 38 L118 62 M58 38 L52 62 M92 38 L70 62 M52 62 H70"
        fill="none"
        stroke="#183C2B"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M118 62 L108 30 H96" fill="none" stroke="#183C2B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M50 34 H66" stroke="#183C2B" strokeWidth="3.5" strokeLinecap="round" />
      <g className="yd-order-bike-box">
        <rect x="68" y="14" width="34" height="24" rx="3" fill="#D85B0B" />
        <path d="M68 24 H102" stroke="#F3E7D3" strokeWidth="1.5" opacity="0.7" />
        <path d="M85 14 V38" stroke="#F3E7D3" strokeWidth="1.5" opacity="0.7" />
        <text
          x="85"
          y="30"
          textAnchor="middle"
          fill="#FAF7F1"
          fontSize="8"
          fontWeight="700"
          fontFamily="Manrope, sans-serif"
        >
          YD
        </text>
      </g>
      <g className="yd-order-bike-rider">
        <circle cx="72" cy="18" r="7" fill="#183C2B" />
        <path d="M68 26 C66 34 62 42 58 48 L66 50 C70 42 74 36 78 30 Z" fill="#287A43" />
        <path d="M78 30 L92 38" stroke="#183C2B" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CheckoutQuoteLoading({ message = "Calculating tax & totals…" }: { message?: string }) {
  return (
    <div
      className="yd-checkout-quote-loading flex min-h-[min(70vh,32rem)] flex-col items-center justify-center rounded-[16px] border border-yd-border bg-gradient-to-b from-[#EEF7F1] via-yd-bg to-yd-cream px-4 py-10 text-center shadow-soft"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="checkout-quote-loading"
    >
      <div className="pointer-events-none relative w-full max-w-lg overflow-hidden" aria-hidden>
        <div className="yd-order-road yd-checkout-road--loop" />
        <div className="yd-order-bike-stage relative mx-auto h-28 w-full sm:h-32">
          <div className="yd-order-bike yd-checkout-bike--loop">
            <DeliveryBikeSvg />
          </div>
        </div>
      </div>
      <p className="mt-4 font-display text-xl text-yd-forest">{message}</p>
      <p className="mt-1 max-w-xs text-sm text-yd-muted">Almost there — locking in your delivery totals.</p>
    </div>
  );
}
