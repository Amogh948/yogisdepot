import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mediaUrl, type Category } from "../../types";
import type { MerchandisingRail } from "../../services/api/products.api";

export type HeroSlide = {
  id: string;
  kind: "merch" | "category" | "default";
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  to: string;
  image?: string;
};

function productImage(product?: { thumbnail?: string; images?: string[] }) {
  return mediaUrl(product?.thumbnail || product?.images?.[0]);
}

export function buildHomeHeroSlides(args: {
  rails: MerchandisingRail[];
  categories: Category[];
  fallbackImage?: string;
}): HeroSlide[] {
  const slides: HeroSlide[] = [];

  for (const rail of args.rails.slice(0, 4)) {
    slides.push({
      id: `merch-${rail.id}`,
      kind: "merch",
      eyebrow: rail.placement === "offers" ? "Limited-time offer" : rail.placement === "gifts" ? "Gift collection" : "Featured collection",
      title: rail.name,
      body: rail.subtitle || `Explore ${rail.products?.length || 0} curated picks from this collection.`,
      ctaLabel: "Shop collection",
      to: `/collections/${rail.slug}`,
      image: mediaUrl(rail.image) || productImage(rail.products?.[0]) || args.fallbackImage,
    });
  }

  for (const category of args.categories.slice(0, 4)) {
    slides.push({
      id: `category-${category.slug}`,
      kind: "category",
      eyebrow: "Shop by category",
      title: category.name,
      body: `Discover ${category.name.toLowerCase()} favourites from trusted brands.`,
      ctaLabel: `Browse ${category.name}`,
      to: `/categories/${category.slug}`,
      image: mediaUrl(category.image) || args.fallbackImage,
    });
  }

  if (!slides.length) {
    slides.push({
      id: "default-home",
      kind: "default",
      eyebrow: "Yogi's Depot",
      title: "Taste Authentic India Everyday",
      body: "Snacks, teas, spices and pantry staples from trusted brands.",
      ctaLabel: "Shop Now",
      to: "/products",
      image: args.fallbackImage,
    });
  }

  return slides;
}

export function HomeHeroCarousel({
  slides,
  intervalMs = 5500,
}: {
  slides: HeroSlide[];
  intervalMs?: number;
}) {
  const safeSlides = useMemo(() => (slides.length ? slides : []), [slides]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [safeSlides.length]);

  useEffect(() => {
    if (paused || safeSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % safeSlides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [paused, safeSlides.length, intervalMs]);

  if (!safeSlides.length) return null;

  const active = safeSlides[Math.min(index, safeSlides.length - 1)];
  const go = (next: number) => {
    const total = safeSlides.length;
    setIndex(((next % total) + total) % total);
  };

  return (
    <section
      className="relative overflow-hidden rounded-[16px] bg-yd-forest min-h-[220px] sm:min-h-[280px] lg:min-h-[340px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured categories and deals"
    >
      {safeSlides.map((slide, slideIndex) => {
        const visible = slideIndex === index;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={!visible}
          >
            {slide.image ? (
              <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-yd-forest via-yd-forest/80 to-yd-forest/25" />
          </div>
        );
      })}

      <div className="relative z-10 flex h-full min-h-[220px] max-w-xl flex-col justify-center p-5 sm:min-h-[280px] sm:p-8 lg:min-h-[340px] lg:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-yd-saffron">{active.eyebrow}</p>
        <h1 className="mt-2 font-display text-[28px] leading-[1.15] text-white sm:text-4xl lg:text-[42px]">{active.title}</h1>
        <p className="mt-2 line-clamp-3 text-sm text-white/80 sm:text-base">{active.body}</p>
        <Link
          to={active.to}
          className="mt-5 inline-flex min-h-11 w-fit items-center rounded-full bg-yd-saffron px-6 text-sm font-bold text-white shadow-soft hover:bg-yd-terracotta"
        >
          {active.ctaLabel}
        </Link>
      </div>

      {safeSlides.length > 1 ? (
        <>
          <div className="absolute bottom-4 left-5 z-20 flex items-center gap-1.5 sm:left-8 lg:left-10">
            {safeSlides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Show slide ${slideIndex + 1}`}
                aria-current={slideIndex === index}
                className={`h-2 rounded-full transition ${slideIndex === index ? "w-6 bg-yd-saffron" : "w-2 bg-white/50 hover:bg-white/80"}`}
                onClick={() => setIndex(slideIndex)}
              />
            ))}
          </div>
          <div className="absolute bottom-3 right-3 z-20 flex gap-2 sm:bottom-4 sm:right-4">
            <button
              type="button"
              aria-label="Previous slide"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-yd-ink/35 text-white backdrop-blur hover:bg-yd-ink/50"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-yd-ink/35 text-white backdrop-blur hover:bg-yd-ink/50"
              onClick={() => go(index + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
