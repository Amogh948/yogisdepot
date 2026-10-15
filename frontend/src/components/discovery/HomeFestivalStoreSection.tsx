import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { merchandisingApi } from "../../services/api/products.api";
import { mediaUrl } from "../../types";
import { SectionHeader, Skeleton } from "../ui/Feedback";
import { resolveFestivalTheme } from "../../content/festivalThemes";

export function HomeFestivalStoreSection() {
  const merch = useQuery({
    queryKey: ["merchandising", "festival", "home"],
    queryFn: () => merchandisingApi.list("festival"),
  });
  const festivals = merch.data?.data || [];

  if (merch.isLoading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-56 shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!festivals.length) return null;

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Festival Store"
        subtitle="Celebrate with sweets, snacks and gift-ready picks"
        action={
          <Link to="/festival" className="text-sm font-semibold text-yd-green">
            View all
          </Link>
        }
      />
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 no-scrollbar">
        {festivals.map((festival) => {
          const theme = resolveFestivalTheme(festival.festivalTheme, festival.slug, festival.name);
          return (
            <Link
              key={festival.id || festival.slug}
              to={`/festival/${festival.slug}`}
              data-festival-theme={theme}
              className="yd-festival-home-card group relative w-56 shrink-0 overflow-hidden rounded-[16px] border border-yd-border bg-white shadow-soft transition hover:border-yd-saffron/50"
            >
              <div className="relative aspect-[16/10] bg-yd-forest">
                {festival.image ? (
                  <img
                    src={mediaUrl(festival.image)}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="grid h-full place-items-center font-display text-3xl text-white/80">
                    {festival.name[0]}
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-yd-saffron px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Festival
                </span>
              </div>
              <div className="p-3">
                <p className="font-display text-lg text-yd-forest">{festival.name}</p>
                {festival.subtitle ? (
                  <p className="mt-1 line-clamp-2 text-xs text-yd-muted">{festival.subtitle}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
