import { Link } from "react-router-dom";
import type { Category } from "../../types";
import { mediaUrl } from "../../types";

export function CategoryCard({
  category,
  countLabel,
}: {
  category: Category;
  countLabel?: string;
}) {
  const image = mediaUrl(category.image);
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-yd-border/70 bg-white shadow-soft transition hover:border-yd-green/30"
    >
      <div className="aspect-square overflow-hidden bg-yd-cream p-4">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-full bg-yd-green/10 font-display text-2xl text-yd-forest">
            {category.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="p-3 text-center">
        <p className="font-semibold text-yd-ink">{category.name}</p>
        {countLabel ? <p className="mt-0.5 text-xs text-yd-muted">{countLabel}</p> : null}
      </div>
    </Link>
  );
}

export function CategoryChipCarousel({ categories }: { categories: Category[] }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain no-scrollbar">
      <div className="grid w-max grid-flow-col gap-3 pb-1 [grid-auto-columns:76px]">
        {categories.map((cat) => {
          const image = mediaUrl(cat.image);
          return (
            <Link key={cat.slug} to={`/categories/${cat.slug}`} className="flex flex-col items-center gap-2 text-center">
              <span className="grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-full border border-yd-border bg-yd-cream">
                {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="font-display text-lg text-yd-forest">{cat.name.slice(0, 1)}</span>}
              </span>
              <span className="line-clamp-2 text-xs font-medium text-yd-ink">{cat.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
