import { useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Contact, ShoppingBag } from "lucide-react";
import { BrandLogo } from "../brand/BrandLogo";
import { SearchBar } from "./SearchBar";
import { CategoryNav } from "./CategoryNav";
import { DeliverToTrigger } from "./DeliverToPicker";
import { useAuthStore } from "../../store/auth.store";
import { useCartItemCount } from "../../hooks/useCatalog";
import { useCartUiStore } from "../../store/cartUi.store";

const BRAND_DOUBLE_TAP_MS = 300;

export function MobileHeader({ hideSearch = false }: { hideSearch?: boolean }) {
  const count = useCartItemCount();
  const cartBump = useCartUiStore((s) => s.bump);
  const location = useLocation();
  const navigate = useNavigate();
  const showCategoryChips = location.pathname === "/";
  const brandTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onBrandTap = (event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault();
    if (brandTapTimer.current) {
      clearTimeout(brandTapTimer.current);
      brandTapTimer.current = null;
      navigate("/admin/dashboard");
      return;
    }
    brandTapTimer.current = setTimeout(() => {
      brandTapTimer.current = null;
      navigate("/");
    }, BRAND_DOUBLE_TAP_MS);
  };

  return (
    <div className="w-full lg:hidden">
      <div className="flex w-full min-w-0 items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <BrandLogo onClick={onBrandTap} imgClassName="h-[4.5rem] w-auto" />
          {hideSearch ? <DeliverToTrigger variant="text" /> : null}
        </div>
        <Link to="/cart" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-yd-border bg-white" aria-label={`Cart${count ? `, ${count} items` : ""}`}>
          <ShoppingBag
            key={cartBump}
            className={`h-5 w-5 text-yd-forest ${cartBump > 0 ? "animate-cartPop" : ""}`}
          />
          {count > 0 ? (
            <span
              key={`badge-${cartBump}`}
              className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-yd-green px-1 text-[10px] font-bold text-white ${cartBump > 0 ? "animate-cartPop" : ""}`}
            >
              {count}
            </span>
          ) : null}
        </Link>
      </div>
      {!hideSearch ? (
        <div className="min-w-0 px-4 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <DeliverToTrigger variant="pill" className="shrink-0" />
            <div className="min-w-0 flex-1">
              <SearchBar size="lg" />
            </div>
          </div>
        </div>
      ) : (
        <div className="pb-2" />
      )}
      {showCategoryChips ? <CategoryNav compact /> : null}
    </div>
  );
}

export function DesktopHeader({ hideSearch = false }: { hideSearch?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const count = useCartItemCount();
  const cartBump = useCartUiStore((s) => s.bump);

  return (
    <div className="hidden lg:block">
      <div className="mx-auto flex w-full max-w-store items-center gap-5 px-8 py-3.5">
        <BrandLogo imgClassName="h-24 w-auto" />
        <DeliverToTrigger variant="pill" />
        <div className="min-w-0 flex-1">{hideSearch ? null : <SearchBar />}</div>
        <nav className="flex items-center gap-5 text-sm font-semibold text-yd-ink">
          <Link to="/products" className="hover:text-yd-green">
            Shop
          </Link>
          <Link to="/search" className="hover:text-yd-green">
            Search
          </Link>
          <Link
            to="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full text-yd-ink hover:bg-yd-cream hover:text-yd-green"
            aria-label={`Cart${count ? `, ${count} items` : ""}`}
          >
            <ShoppingBag
              key={cartBump}
              className={`h-5 w-5 ${cartBump > 0 ? "animate-cartPop" : ""}`}
              strokeWidth={1.75}
            />
            {count > 0 ? (
              <span
                key={`desktop-badge-${cartBump}`}
                className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-yd-green px-1 text-[10px] font-bold text-white ${cartBump > 0 ? "animate-cartPop" : ""}`}
              >
                {count}
              </span>
            ) : null}
          </Link>
          {user ? (
            <Link
              to="/profile"
              className="grid h-10 w-10 place-items-center rounded-full text-yd-ink hover:bg-yd-cream hover:text-yd-green"
              aria-label="Account"
            >
              <Contact className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          ) : (
            <Link
              to="/login"
              className="grid h-10 w-10 place-items-center rounded-full text-yd-ink hover:bg-yd-cream hover:text-yd-green"
              aria-label="Sign in"
            >
              <Contact className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          )}
          {user?.role === "admin" ? (
            <Link to="/admin/dashboard" className="text-yd-muted hover:text-yd-green">
              Admin
            </Link>
          ) : null}
          {user?.role === "vendor" ? (
            <Link to="/vendor/dashboard" className="text-yd-muted hover:text-yd-green">
              Vendor
            </Link>
          ) : null}
        </nav>
      </div>
      <div className="border-t border-yd-border/80">
        <div className="mx-auto max-w-store px-8 py-2.5">
          <CategoryNav />
        </div>
      </div>
    </div>
  );
}
