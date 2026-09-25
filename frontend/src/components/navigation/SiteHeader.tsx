import { Link, useLocation } from "react-router-dom";
import { MapPin, ShoppingBag } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { CategoryNav } from "./CategoryNav";
import { useAuthStore } from "../../store/auth.store";
import { useCartItemCount } from "../../hooks/useCatalog";

export function MobileHeader({ hideSearch = false }: { hideSearch?: boolean }) {
  const count = useCartItemCount();
  const location = useLocation();
  const showCategoryChips = location.pathname === "/";

  return (
    <div className="w-full lg:hidden">
      <div className="flex w-full min-w-0 items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <Link to="/" className="font-display text-[22px] font-semibold leading-none text-yd-saffron">
            Yogi&apos;s Depot
          </Link>
          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-xs text-yd-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-yd-green" aria-hidden />
            <span className="truncate">Deliver to Bengaluru</span>
          </p>
        </div>
        <Link to="/cart" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-yd-border bg-white" aria-label={`Cart${count ? `, ${count} items` : ""}`}>
          <ShoppingBag className="h-5 w-5 text-yd-forest" />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-yd-green px-1 text-[10px] font-bold text-white">
              {count}
            </span>
          ) : null}
        </Link>
      </div>
      {!hideSearch ? (
        <div className="min-w-0 px-4 pb-2 pt-3">
          <SearchBar size="lg" />
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

  return (
    <div className="hidden lg:block">
      <div className="mx-auto flex w-full max-w-store items-center gap-5 px-8 py-3">
        <Link to="/" className="shrink-0 font-display text-2xl font-semibold text-yd-saffron">
          Yogi&apos;s Depot
        </Link>
        <button type="button" className="flex max-w-[160px] items-center gap-1.5 rounded-full border border-yd-border bg-white px-3 py-2 text-left text-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-yd-green" aria-hidden />
          <span className="truncate text-yd-muted">
            Deliver to <span className="font-semibold text-yd-ink">Bengaluru</span>
          </span>
        </button>
        <div className="min-w-0 flex-1">{hideSearch ? null : <SearchBar />}</div>
        <nav className="flex items-center gap-5 text-sm font-semibold text-yd-ink">
          <Link to="/products" className="hover:text-yd-green">
            Shop
          </Link>
          <Link to="/search" className="hover:text-yd-green">
            Search
          </Link>
          <Link to="/cart" className="relative hover:text-yd-green">
            Cart
            {count > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-yd-green px-1.5 text-[10px] text-white">{count}</span>
            ) : null}
          </Link>
          {user ? (
            <Link to="/profile" className="hover:text-yd-green">
              Account
            </Link>
          ) : (
            <Link to="/login" className="hover:text-yd-green">
              Sign in
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
