import { useEffect, useState } from "react";
import { mediaUrl } from "../../types";

/**
 * Shared checkout wait artwork — matches order-success / tax-quote bike styling
 * (SVG + CSS, forest/saffron palette). No Lottie dependency for consistency.
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

function BasketSvg() {
  return (
    <svg viewBox="0 0 72 56" width="72" height="56" aria-hidden focusable="false" className="yd-checkout-basket-svg">
      <path
        d="M8 18 H64 L58 48 H14 Z"
        fill="#F3E7D3"
        stroke="#183C2B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M14 18 C14 8 22 4 36 4 C50 4 58 8 58 18" fill="none" stroke="#183C2B" strokeWidth="2.5" />
      <path d="M20 28 H52 M18 36 H54 M16 44 H56" stroke="#287A43" strokeWidth="1.5" opacity="0.55" />
    </svg>
  );
}

function DestinationPinSvg() {
  return (
    <svg viewBox="0 0 40 48" width="40" height="48" aria-hidden focusable="false">
      <path
        d="M20 46 C20 46 36 30 36 18 C36 9.2 28.8 2 20 2 C11.2 2 4 9.2 4 18 C4 30 20 46 20 46 Z"
        fill="#D85B0B"
        stroke="#183C2B"
        strokeWidth="2"
      />
      <circle cx="20" cy="18" r="7" fill="#FAF7F1" />
      <path d="M14 22 V30 H26 V22" fill="#287A43" opacity="0.9" />
      <path d="M12 22 L20 16 L28 22" fill="none" stroke="#183C2B" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerFallback() {
  return (
    <div
      className="h-10 w-10 animate-spin rounded-full border-2 border-yd-border border-t-yd-green"
      aria-hidden
    />
  );
}

/** Delay showing the loader so sub-200ms responses do not flash. */
export function useDelayedShow(active: boolean, delayMs = 200): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);
  return show;
}

type CheckoutLoadingAnimationProps = {
  message?: string;
  detail?: string;
  /** Cart product image URLs (or paths) that drop into the basket. */
  itemImages?: string[];
  /** `quote` = bike loop only; `payment` = basket packing + bike toward destination. */
  variant?: "quote" | "payment";
  className?: string;
  /** Force the simple spinner (e.g. after artwork error). */
  forceFallback?: boolean;
};

export function CheckoutLoadingAnimation({
  message = "Calculating tax & totals…",
  detail = "Almost there — locking in your delivery totals.",
  itemImages = [],
  variant = "quote",
  className = "",
  forceFallback = false,
}: CheckoutLoadingAnimationProps) {
  const [artFailed, setArtFailed] = useState(forceFallback);
  const images = itemImages
    .map((src) => mediaUrl(src) || src)
    .filter(Boolean)
    .slice(0, 4);

  const showFallback = artFailed || forceFallback;

  return (
    <div
      className={`yd-checkout-quote-loading flex h-full min-h-[min(70vh,32rem)] w-full flex-col items-center justify-center bg-gradient-to-b from-[#EEF7F1] via-yd-bg to-yd-cream px-4 py-10 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid={variant === "payment" ? "checkout-payment-loading" : "checkout-quote-loading"}
    >
      {showFallback ? (
        <div className="flex flex-col items-center gap-3">
          <SpinnerFallback />
        </div>
      ) : (
        <div
          className="pointer-events-none relative w-full max-w-2xl overflow-hidden"
          aria-hidden
          onErrorCapture={() => setArtFailed(true)}
        >
          {variant === "payment" ? (
            <div className="yd-checkout-pack-stage relative mx-auto mb-2 h-24 w-full max-w-xs">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                <BasketSvg />
              </div>
              {(images.length ? images : [null, null, null]).map((src, index) => (
                <div
                  key={`pack-${index}-${src || "blank"}`}
                  className="yd-checkout-pack-item absolute left-1/2 top-0"
                  style={{ ["--pack-delay" as string]: `${index * 280}ms` }}
                >
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover shadow-soft ring-1 ring-yd-border/60"
                      onError={() => setArtFailed(true)}
                    />
                  ) : (
                    <div
                      className="h-9 w-9 rounded-lg bg-yd-saffron/80 shadow-soft ring-1 ring-yd-forest/10"
                      style={{ opacity: 0.85 - index * 0.1 }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="yd-order-road yd-checkout-road--loop" />
          <div className="yd-order-bike-stage relative mx-auto h-28 w-full sm:h-32">
            {variant === "payment" ? (
              <div className="yd-checkout-destination absolute right-2 top-1/2 z-[1] -translate-y-[60%] sm:right-4">
                <DestinationPinSvg />
              </div>
            ) : null}
            <div className="yd-order-bike yd-checkout-bike--loop">
              <DeliveryBikeSvg />
            </div>
          </div>
        </div>
      )}
      <p className="mt-4 font-display text-xl text-yd-forest">{message}</p>
      <p className="mt-1 max-w-xs text-sm text-yd-muted">{detail}</p>
    </div>
  );
}

/** @deprecated Prefer CheckoutLoadingAnimation — kept for existing quote call sites. */
export function CheckoutQuoteLoading({ message = "Calculating tax & totals…" }: { message?: string }) {
  return (
    <CheckoutLoadingAnimation
      variant="quote"
      message={message}
      detail="Almost there — locking in your delivery totals."
      className="rounded-[16px] border border-yd-border shadow-soft"
    />
  );
}

export function CheckoutPaymentLoading({
  itemImages,
  /** Full-viewport cover (default). Use `card` to fill only the payment card. */
  cover = "screen",
}: {
  itemImages?: string[];
  cover?: "screen" | "card";
}) {
  const panel = (
    <CheckoutLoadingAnimation
      variant="payment"
      itemImages={itemImages}
      message="Preparing secure payment…"
      detail="Basket loaded. Goodies secured. Delivery mode ACTIVATED. Your cravings are about to hit your doorstep! 🚀"
      className={
        cover === "screen"
          ? "min-h-full rounded-none border-0 shadow-none"
          : "min-h-full rounded-[14px] border border-yd-border shadow-soft"
      }
    />
  );

  if (cover === "card") {
    return <div className="absolute inset-0 z-10 overflow-hidden rounded-[14px]">{panel}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex flex-col bg-gradient-to-b from-[#EEF7F1] via-yd-bg to-yd-cream pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      data-testid="checkout-payment-loading-cover"
    >
      {panel}
    </div>
  );
}
