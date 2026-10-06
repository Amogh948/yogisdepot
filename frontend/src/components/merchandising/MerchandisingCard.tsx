import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { mediaUrl } from "../../types";
import type { MerchandisingRail } from "../../services/api/products.api";
import { SectionHeader } from "../ui/Feedback";

export function MerchandisingCard({ rail }: { rail: MerchandisingRail }) {
  const image = mediaUrl(rail.image || rail.products?.[0]?.thumbnail || rail.products?.[0]?.images?.[0]);
  const count = rail.products?.length || 0;

  return (
    <Link
      to={`/collections/${rail.slug}`}
      className="group relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[14px] border border-yd-border bg-yd-cream shadow-soft transition hover:border-yd-green/40"
    >
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-yd-forest to-yd-green" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-yd-ink/80 via-yd-ink/25 to-transparent" />
      <div className="relative z-10 mt-auto p-3.5 text-white">
        <p className="font-display text-lg leading-tight">{rail.name}</p>
        {rail.subtitle ? <p className="mt-1 line-clamp-2 text-xs text-white/85">{rail.subtitle}</p> : null}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yd-saffron">
          {count ? `Shop ${count} picks` : "Explore"}
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export function MerchandisingCardCarousel({
  title = "Featured collections",
  subtitle,
  rails,
}: {
  title?: string;
  subtitle?: string;
  rails: MerchandisingRail[];
}) {
  if (!rails.length) return null;

  return (
    <section className="w-full min-w-0 max-w-full">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 no-scrollbar lg:overflow-visible">
        <div className="grid w-full grid-flow-col grid-cols-none gap-2.5 [grid-auto-columns:minmax(9.5rem,10.5rem)] lg:grid lg:grid-flow-row lg:grid-cols-4 lg:gap-3 lg:[grid-auto-columns:unset] xl:grid-cols-5">
          {rails.map((rail) => (
            <MerchandisingCard key={rail.id} rail={rail} />
          ))}
        </div>
      </div>
    </section>
  );
}
