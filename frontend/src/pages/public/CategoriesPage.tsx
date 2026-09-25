import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useCategories } from "../../hooks/useCatalog";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Feedback";
import { mediaUrl } from "../../types";

export function CategoriesPage() {
  const categories = useCategories();
  const parents = (categories.data?.data || []).filter((c) => !c.parentId);

  return (
    <div>
      <Helmet>
        <title>All Categories | Yogi&apos;s Depot</title>
      </Helmet>
      <h1 className="mb-5 font-display text-3xl text-yd-forest">All Categories</h1>
      {categories.isLoading ? (
        <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : categories.isError ? (
        <ErrorState message="Unable to load categories" retry={() => categories.refetch()} />
      ) : !parents.length ? (
        <EmptyState title="No categories yet" body="Check back soon for fresh Indian pantry collections." />
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 md:grid-cols-4 lg:grid-cols-6">
          {parents.map((cat) => {
            const image = mediaUrl(cat.image);
            return (
              <Link key={cat.slug} to={`/categories/${cat.slug}`} className="flex flex-col items-center gap-2 text-center">
                <span className="grid h-[88px] w-[88px] place-items-center overflow-hidden rounded-full border border-yd-border bg-yd-cream shadow-soft sm:h-24 sm:w-24">
                  {image ? (
                    <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="font-display text-2xl text-yd-forest">{cat.name[0]}</span>
                  )}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-yd-ink">{cat.name}</span>
                  <span className="block text-[11px] text-yd-muted">Shop now</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
