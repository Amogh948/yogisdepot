import { Link, NavLink } from "react-router-dom";
import { CATEGORY_NAV } from "../../content/navigation";

export function CategoryNav({ compact = false }: { compact?: boolean }) {
  if (compact) {
    const items = CATEGORY_NAV.filter((item) => item.label !== "More").slice(0, 6);
    return (
      <nav aria-label="Categories" className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain no-scrollbar px-4 pb-3">
        <div className="grid w-max grid-flow-col gap-3 [grid-auto-columns:64px]">
          {items.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.to === "/products"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 text-center ${isActive ? "text-yd-green" : "text-yd-ink"}`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-full border font-display text-lg ${
                      isActive ? "border-yd-green bg-yd-green/10 text-yd-forest" : "border-yd-border bg-white text-yd-forest"
                    }`}
                  >
                    {item.label === "All" ? "All" : item.label[0]}
                  </span>
                  <span className="line-clamp-1 text-[11px] font-semibold">
                    {item.label === "Tea & Coffee" ? "Tea" : item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <Link to="/categories" className="flex flex-col items-center gap-1.5 text-center text-yd-ink">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-yd-border bg-white font-display text-lg text-yd-forest">
              +
            </span>
            <span className="text-[11px] font-semibold">More</span>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Categories" className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain no-scrollbar">
      <div className="flex w-max gap-2">
        {CATEGORY_NAV.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.to === "/products" || item.to === "/categories"}
            className={({ isActive }) =>
              `shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-yd-forest bg-yd-forest text-white"
                  : "border-yd-border bg-white text-yd-ink hover:border-yd-green/40"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <Link to="/offers" className="shrink-0 rounded-full border border-yd-saffron/30 bg-yd-saffron/10 px-3.5 py-2 text-sm font-semibold text-yd-saffron">
          Offers
        </Link>
      </div>
    </nav>
  );
}
