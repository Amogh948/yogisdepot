import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useViewCartSummary } from "../../hooks/useCatalog";
import { useCartUiStore } from "../../store/cartUi.store";

const HIDDEN_PREFIXES = ["/cart", "/checkout", "/login", "/register", "/order-success"];

function shouldHideOnRoute(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProductDetailPath(pathname: string): boolean {
  return /^\/products\/[^/]+$/.test(pathname);
}

export function ViewCartBar() {
  const location = useLocation();
  const { ready, itemCount, thumbnails } = useViewCartSummary();
  const cartBump = useCartUiStore((s) => s.bump);
  const hiddenRoute = shouldHideOnRoute(location.pathname);
  const productDetail = isProductDetailPath(location.pathname);
  const shouldShow = ready && !hiddenRoute && itemCount > 0;

  const [mounted, setMounted] = useState(shouldShow);
  const [visible, setVisible] = useState(shouldShow);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (shouldShow) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    hideTimer.current = setTimeout(() => {
      setMounted(false);
      hideTimer.current = null;
    }, 220);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [shouldShow]);

  if (!mounted) return null;

  const itemLabel = itemCount === 1 ? "1 Item" : `${itemCount} Items`;
  const preview = thumbnails.length > 0 ? thumbnails : [];

  return (
    <div
      className={[
        "pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-4 lg:justify-end lg:px-8",
        productDetail
          ? "bottom-[calc(3.25rem+env(safe-area-inset-bottom)+8.75rem)] lg:bottom-6"
          : "bottom-[calc(3.25rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6",
      ].join(" ")}
    >
      <Link
        to="/cart"
        aria-label={`View cart, ${itemLabel}`}
        className={[
          "pointer-events-auto yd-view-cart-bar flex w-full max-w-[22rem] items-center gap-3 rounded-full bg-yd-green px-2.5 py-2 text-white shadow-card outline-none transition",
          "hover:bg-yd-green-dark focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-yd-green",
          "active:scale-[0.98] lg:max-w-[20rem]",
          visible ? "yd-view-cart-bar--in" : "yd-view-cart-bar--out",
        ].join(" ")}
      >
        <div
          className="relative flex h-11 shrink-0 items-center"
          style={{ width: preview.length > 1 ? 44 + (preview.length - 1) * 14 : 44 }}
          aria-hidden
        >
          {preview.length > 0 ? (
            preview.map((src, index) => (
              <span
                key={`${src}-${index}`}
                className="absolute top-0 h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-yd-cream shadow-soft"
                style={{ left: index * 14, zIndex: preview.length - index }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </span>
            ))
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-white text-yd-green">
              <ShoppingBag className="h-5 w-5" strokeWidth={2} />
            </span>
          )}
        </div>

        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-bold tracking-tight">View cart</span>
          <span
            key={`count-${cartBump}-${itemCount}`}
            className={`block text-xs font-medium text-white/90 ${cartBump > 0 ? "animate-cartPop inline-block" : ""}`}
          >
            {itemLabel}
          </span>
        </span>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-yd-green shadow-soft" aria-hidden>
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </span>
      </Link>
    </div>
  );
}
