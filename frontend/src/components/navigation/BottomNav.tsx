import { useLayoutEffect, useRef } from "react";
import { Home, LayoutGrid, Search, ShoppingBag, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCartItemCount } from "../../hooks/useCatalog";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/categories", label: "Categories", icon: LayoutGrid },
  { to: "/search", label: "Search", icon: Search },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/profile", label: "Account", icon: UserRound },
];

/** Keep fixed nav width equal to the layout viewport (fixes DevTools / visualViewport mismatch). */
function useViewportWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const width = document.documentElement.clientWidth;
      el.style.width = `${width}px`;
      el.style.left = "0px";
      el.style.right = "auto";
    };
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);
  return ref;
}

export function BottomNav() {
  const count = useCartItemCount();
  const ref = useViewportWidth<HTMLElement>();

  return (
    <nav
      ref={ref}
      className="fixed bottom-0 z-40 border-t border-yd-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      <ul className="grid w-full grid-cols-5">
        {items.map((item) => (
          <li key={item.to} className="min-w-0">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-medium leading-tight ${
                  isActive ? "text-yd-green" : "text-yd-muted"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
              {item.to === "/cart" && count > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-yd-green px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              ) : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
