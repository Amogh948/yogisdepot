import { Link, NavLink } from "react-router-dom";
import { useCategories } from "../../hooks/useCatalog";
import type { Category } from "../../types";

function parentCategories(categories: Category[] | undefined): Category[] {
  return (categories || []).filter((category) => !category.parentId);
}

const chipClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
    isActive
      ? "border-yd-forest bg-yd-forest text-white"
      : "border-yd-border bg-white text-yd-ink hover:border-yd-green/40"
  }`;

export function CategoryNav({ compact = false }: { compact?: boolean }) {
  const categoriesQuery = useCategories();
  const parents = parentCategories(categoriesQuery.data?.data);

  return (
    <nav
      aria-label="Categories"
      className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain no-scrollbar ${
        compact ? "px-4 pb-3" : ""
      }`}
    >
      <div className="flex w-max gap-2">
        <NavLink to="/products" end className={chipClass}>
          All
        </NavLink>
        {categoriesQuery.isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-yd-cream" />
            ))
          : parents.map((category) => (
              <NavLink key={category.slug} to={`/categories/${category.slug}`} className={chipClass}>
                {category.name}
              </NavLink>
            ))}
        <Link
          to="/categories"
          className="shrink-0 rounded-full border border-yd-border bg-white px-3.5 py-2 text-sm font-semibold text-yd-ink hover:border-yd-green/40"
        >
          More
        </Link>
        {!compact ? (
          <Link
            to="/offers"
            className="shrink-0 rounded-full border border-yd-saffron/30 bg-yd-saffron/10 px-3.5 py-2 text-sm font-semibold text-yd-saffron"
          >
            Offers
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
