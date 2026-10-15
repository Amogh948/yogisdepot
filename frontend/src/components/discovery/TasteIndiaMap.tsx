import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { REGIONS, type TasteIndiaRegion, type TasteIndiaRegionSlug } from "../../content/discovery";

/** Simplified India outline zones — stylized hit targets, not cartographic. */
const REGION_PATHS: Record<TasteIndiaRegionSlug, string> = {
  "north-india":
    "M120 28 L165 22 L210 38 L225 70 L200 95 L155 105 L110 90 L95 55 Z",
  "west-india":
    "M70 100 L110 90 L150 115 L145 175 L100 200 L65 170 L55 130 Z",
  "east-india":
    "M200 95 L245 85 L270 120 L255 165 L210 175 L185 145 L190 110 Z",
  "northeast-india":
    "M255 70 L295 55 L320 85 L305 120 L270 115 L255 90 Z",
  "south-india":
    "M100 200 L145 175 L185 185 L195 240 L165 290 L130 275 L105 230 Z",
};

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function useCanHover() {
  const [canHover, setCanHover] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(HOVER_QUERY).matches
      : true,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(HOVER_QUERY);
    const onChange = () => setCanHover(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return canHover;
}

type TasteIndiaMapProps = {
  /** When set, highlights that region (e.g. on region detail). */
  activeSlug?: TasteIndiaRegionSlug;
  /** Compact layout for home. */
  compact?: boolean;
};

export function TasteIndiaMap({ activeSlug, compact = false }: TasteIndiaMapProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const canHover = useCanHover();
  const [hovered, setHovered] = useState<TasteIndiaRegionSlug | null>(null);
  /** Touch / click selection — persists until another region is chosen or navigated. */
  const [selected, setSelected] = useState<TasteIndiaRegionSlug>(activeSlug ?? REGIONS[0].slug);
  const previewSlug = hovered || selected || activeSlug || REGIONS[0].slug;
  const preview = REGIONS.find((r) => r.slug === previewSlug) || REGIONS[0];

  useEffect(() => {
    if (activeSlug) setSelected(activeSlug);
  }, [activeSlug]);

  const go = (slug: TasteIndiaRegionSlug) => {
    navigate(`/discover/regions/${slug}`);
  };

  const onRegionClick = (slug: TasteIndiaRegionSlug) => {
    if (canHover) {
      go(slug);
      return;
    }
    // Mobile / coarse pointer: first tap highlights, second tap opens.
    if (selected === slug) {
      go(slug);
    } else {
      setSelected(slug);
      setHovered(null);
    }
  };

  return (
    <div
      className={`grid gap-4 ${compact ? "lg:grid-cols-[minmax(0,1fr)_220px]" : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"}`}
    >
      <div className="relative overflow-hidden rounded-[16px] border border-yd-border bg-gradient-to-b from-[#EEF7F1] to-yd-cream p-3 sm:p-4">
        <svg
          viewBox="40 10 300 300"
          className="mx-auto h-auto w-full max-w-md"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>Interactive map of Taste India regions</title>
          {REGIONS.map((region) => {
            const isActive = region.slug === previewSlug;
            return (
              <path
                key={region.slug}
                d={REGION_PATHS[region.slug]}
                fill={isActive ? region.fill : "#F8F4EC"}
                stroke={isActive ? region.accent : "#C9BBA8"}
                strokeWidth={isActive ? 2.5 : 1.5}
                className={`yd-taste-map-region cursor-pointer outline-none transition-[fill,stroke,filter] duration-200 ${
                  isActive ? "yd-taste-map-region--active" : ""
                }`}
                tabIndex={0}
                role="link"
                aria-label={`${region.name}: ${region.tagline}`}
                aria-current={isActive ? "true" : undefined}
                onMouseEnter={() => {
                  if (canHover) setHovered(region.slug);
                }}
                onMouseLeave={() => {
                  if (canHover) setHovered(null);
                }}
                onFocus={() => setHovered(region.slug)}
                onBlur={() => setHovered(null)}
                onClick={() => onRegionClick(region.slug)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    go(region.slug);
                  }
                }}
              />
            );
          })}
        </svg>
        <p className="mt-2 text-center text-xs text-yd-muted">
          {canHover
            ? "Hover a region to preview, click to explore"
            : "Tap a region to highlight, tap again to explore"}
        </p>
      </div>

      <aside className="flex flex-col justify-center rounded-[16px] border border-yd-border bg-white p-4 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wide text-yd-muted">Exploring</p>
        <h3 className="mt-1 font-display text-2xl text-yd-forest" style={{ color: preview.accent }}>
          {preview.name}
        </h3>
        <p className="mt-1 text-sm font-medium text-yd-ink">{preview.tagline}</p>
        <p className="mt-2 text-sm text-yd-muted">{preview.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {preview.specialties.map((item) => (
            <span
              key={item}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: preview.fill, color: preview.accent }}
            >
              {item}
            </span>
          ))}
        </div>
        <Link
          to={`/discover/regions/${preview.slug}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-yd-green px-4 text-sm font-bold text-white hover:bg-yd-green-dark"
        >
          Shop {preview.name} →
        </Link>
      </aside>

      <ul className="col-span-full flex flex-wrap gap-2" aria-label="All Taste India regions">
        {REGIONS.map((region) => (
          <li key={region.slug}>
            <RegionChip
              region={region}
              active={region.slug === previewSlug}
              onSelect={
                canHover
                  ? undefined
                  : () => {
                      setSelected(region.slug);
                      setHovered(null);
                    }
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RegionChip({
  region,
  active,
  onSelect,
}: {
  region: TasteIndiaRegion;
  active: boolean;
  /** When set (touch), first interaction highlights the map instead of navigating. */
  onSelect?: () => void;
}) {
  const className = `inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition ${
    active
      ? "border-transparent text-white"
      : "border-yd-border bg-white text-yd-ink hover:border-yd-green/40"
  }`;
  const style = active ? { backgroundColor: region.accent } : undefined;

  if (onSelect && !active) {
    return (
      <button type="button" className={className} style={style} onClick={onSelect}>
        {region.name}
      </button>
    );
  }

  return (
    <Link to={`/discover/regions/${region.slug}`} className={className} style={style}>
      {region.name}
    </Link>
  );
}
