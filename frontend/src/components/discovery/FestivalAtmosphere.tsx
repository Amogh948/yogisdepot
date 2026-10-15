import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  festivalThemeCssVars,
  type FestivalTheme,
} from "../../content/festivalThemes";
import { mediaUrl } from "../../types";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type FestivalThemeShellProps = {
  theme: FestivalTheme;
  children: ReactNode;
  className?: string;
};

/** Full-page festival wash: background, accents, and pattern driven by theme tokens. */
export function FestivalThemeShell({ theme, children, className = "" }: FestivalThemeShellProps) {
  const vars = festivalThemeCssVars(theme) as CSSProperties;
  return (
    <div
      className={`yd-fest-page yd-fest-page--${theme} ${className}`}
      data-festival-theme={theme}
      style={vars}
    >
      <div className="yd-fest-page-pattern" aria-hidden />
      <div className="relative z-[1] space-y-6">{children}</div>
    </div>
  );
}

type FestivalAtmosphereProps = {
  theme: FestivalTheme;
  title: string;
  subtitle?: string;
  /** Admin-uploaded festival image (Cloudinary / local URL). */
  imageUrl?: string | null;
  /** Multiple hero images — rotates when more than one. */
  imageUrls?: string[] | null;
};

const NAVRATRI_COLOURS = [
  "#FF6B6B",
  "#FF9F43",
  "#FECA57",
  "#1DD1A1",
  "#54A0FF",
  "#5F27CD",
  "#FF9FF3",
  "#C8D6E5",
  "#F368E0",
];

export function FestivalAtmosphere({ theme, title, subtitle, imageUrl, imageUrls }: FestivalAtmosphereProps) {
  const titleId = useId();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [lightsOn, setLightsOn] = useState(true);
  const [burstKey, setBurstKey] = useState(0);
  const [slide, setSlide] = useState(0);
  const gallery = useMemo(() => {
    const fromList = (imageUrls || []).map((url) => mediaUrl(url)).filter(Boolean);
    if (fromList.length) return fromList;
    const single = imageUrl ? mediaUrl(imageUrl) : "";
    return single ? [single] : [];
  }, [imageUrls, imageUrl]);
  const resolvedImage = gallery[slide] || gallery[0] || "";

  useEffect(() => {
    if (reduced || theme !== "diwali" || !lightsOn) return;
    const timer = window.setInterval(() => setBurstKey((k) => k + 1), 4200);
    return () => window.clearInterval(timer);
  }, [theme, lightsOn, reduced]);

  const galleryKey = gallery.join("|");

  useEffect(() => {
    setSlide(0);
  }, [galleryKey]);

  useEffect(() => {
    if (reduced || gallery.length < 2) return;
    const timer = window.setInterval(() => {
      setSlide((index) => (index + 1) % gallery.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [gallery.length, reduced]);

  const lightText = theme === "navratri" || theme === "holi" || theme === "generic" ? false : true;

  return (
    <section
      className={`yd-fest-hero yd-fest-hero--${theme} relative overflow-hidden rounded-[20px] ${
        lightsOn && theme === "diwali" ? "yd-fest-lights-on" : ""
      } ${lightText ? "text-white" : "text-[color:var(--fest-accent)]"}`}
      aria-labelledby={titleId}
      data-festival-theme={theme}
      data-reduced-motion={reduced ? "true" : "false"}
      data-has-image={resolvedImage ? "true" : "false"}
    >
      {/* Admin hero images — rotate when multiple uploads exist */}
      {gallery.length ? (
        <div className="absolute inset-0" aria-hidden>
          {gallery.map((src, index) => (
            <img
              key={`${src}-${index}`}
              src={src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                index === slide ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="yd-fest-hero-scrim absolute inset-0" />
        </div>
      ) : (
        <div className="yd-fest-hero-fallback absolute inset-0" aria-hidden />
      )}

      {/* Toran / arch motif for Navratri-like immersion */}
      {(theme === "navratri" || theme === "diwali") && (
        <div className="yd-fest-toran pointer-events-none absolute inset-x-0 top-0 h-10" aria-hidden />
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {theme === "diwali" ? <DiwaliDecor reduced={reduced} lightsOn={lightsOn} burstKey={burstKey} /> : null}
        {theme === "navratri" ? <NavratriDecor reduced={reduced} /> : null}
        {theme === "holi" && !reduced ? <HoliDecor /> : null}
        {theme === "eid" ? <EidDecor reduced={reduced} /> : null}
        {theme === "generic" && !reduced ? <GenericSparkle /> : null}
      </div>

      <div className="relative z-10 flex min-h-[200px] flex-col justify-end px-5 py-6 sm:min-h-[260px] sm:px-8 sm:py-8">
        <p
          className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
            lightText || resolvedImage ? "text-white/80" : "text-[color:var(--fest-highlight)]"
          }`}
        >
          Celebrate
        </p>
        <h1
          id={titleId}
          className={`mt-1 font-display text-3xl leading-tight sm:text-4xl ${
            lightText || resolvedImage ? "text-white" : "text-[color:var(--fest-accent)]"
          }`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={`mt-2 max-w-xl text-sm ${
              lightText || resolvedImage ? "text-white/90" : "text-[color:var(--fest-muted)]"
            }`}
          >
            {subtitle}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {theme === "diwali" ? (
            <button
              type="button"
              className="pointer-events-auto inline-flex min-h-10 w-fit items-center rounded-full border border-white/50 bg-white/20 px-4 text-sm font-bold text-white backdrop-blur hover:bg-white/30"
              onClick={() => setLightsOn((v) => !v)}
              aria-pressed={lightsOn}
            >
              {lightsOn ? "Dim the lights" : "Change lights"}
            </button>
          ) : null}
          {gallery.length > 1 ? (
            <div className="pointer-events-auto flex items-center gap-1.5" role="tablist" aria-label="Festival images">
              {gallery.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === slide}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === slide ? "bg-white scale-110" : "bg-white/45 hover:bg-white/70"
                  }`}
                  onClick={() => setSlide(index)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DiwaliDecor({
  reduced,
  lightsOn,
  burstKey,
}: {
  reduced: boolean;
  lightsOn: boolean;
  burstKey: number;
}) {
  return (
    <>
      <div className={`yd-fest-string-lights ${lightsOn ? "yd-fest-string-lights--glow" : ""}`}>
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="yd-fest-bulb"
            style={{ left: `${4 + i * 7}%`, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      {!reduced && lightsOn
        ? Array.from({ length: 3 }, (_, i) => (
            <span
              key={`${burstKey}-${i}`}
              className="yd-fest-cracker"
              style={
                {
                  left: `${20 + i * 28}%`,
                  top: `${30 + (i % 2) * 20}%`,
                  "--delay": `${i * 180}ms`,
                } as CSSProperties
              }
            />
          ))
        : null}
      <svg className="absolute bottom-3 right-4 h-14 w-14 opacity-90" viewBox="0 0 64 64" aria-hidden>
        <ellipse cx="32" cy="48" rx="14" ry="6" fill="#F3E7D3" opacity="0.5" />
        <path d="M20 46 Q32 18 44 46 Z" fill="#D85B0B" />
        <ellipse
          cx="32"
          cy="22"
          rx="4"
          ry="6"
          fill="#FECA57"
          className={lightsOn && !reduced ? "yd-fest-diya-flame" : ""}
        />
      </svg>
    </>
  );
}

function NavratriDecor({ reduced }: { reduced: boolean }) {
  return (
    <>
      <div className={`yd-fest-navratri-ribbon ${reduced ? "" : "yd-fest-navratri-ribbon--spin"}`}>
        {NAVRATRI_COLOURS.map((color) => (
          <span key={color} style={{ backgroundColor: color }} />
        ))}
      </div>
      {/* Abstract Durga eyes motif — Blinkit-inspired symbolic layer */}
      <svg
        className="absolute left-1/2 top-6 h-16 w-40 -translate-x-1/2 opacity-40"
        viewBox="0 0 160 48"
        aria-hidden
      >
        <ellipse cx="48" cy="24" rx="22" ry="14" fill="none" stroke="#8B1E3F" strokeWidth="3" />
        <ellipse cx="112" cy="24" rx="22" ry="14" fill="none" stroke="#8B1E3F" strokeWidth="3" />
        <circle cx="48" cy="24" r="6" fill="#8B1E3F" />
        <circle cx="112" cy="24" r="6" fill="#8B1E3F" />
        <circle cx="80" cy="36" r="4" fill="#C1121F" />
      </svg>
      <svg className="absolute -right-2 bottom-0 h-36 w-28 opacity-25" viewBox="0 0 80 120" aria-hidden>
        <ellipse cx="40" cy="22" rx="10" ry="12" fill="#8B1E3F" />
        <path d="M28 34 Q40 50 52 34 L56 90 Q40 100 24 90 Z" fill="#8B1E3F" />
        <path
          d="M18 48 L8 42 M62 48 L72 42 M22 58 L10 62 M58 58 L70 62"
          stroke="#FECA57"
          strokeWidth="2"
        />
      </svg>
    </>
  );
}

function HoliDecor() {
  return (
    <>
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="yd-fest-holi-powder"
          style={
            {
              left: `${(i * 13) % 90}%`,
              "--hue": ["#FF6B6B", "#54A0FF", "#FECA57", "#1DD1A1", "#FF9FF3"][i % 5],
              "--delay": `${i * 200}ms`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

function EidDecor({ reduced }: { reduced: boolean }) {
  return (
    <>
      <svg
        className={`absolute right-6 top-4 h-16 w-16 text-[#FECA57] ${reduced ? "" : "yd-fest-eid-shimmer"}`}
        viewBox="0 0 64 64"
        aria-hidden
      >
        <path d="M40 8 A22 22 0 1 0 40 56 A16 16 0 1 1 40 8 Z" fill="currentColor" opacity="0.85" />
      </svg>
      <svg className="absolute bottom-2 left-4 h-20 w-12 opacity-70" viewBox="0 0 40 70" aria-hidden>
        <rect x="12" y="20" width="16" height="40" rx="2" fill="#FECA57" />
        <path d="M12 20 Q20 8 28 20" fill="#F5C542" />
        <circle cx="20" cy="36" r="3" fill="#183C2B" opacity="0.4" />
      </svg>
    </>
  );
}

function GenericSparkle() {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="yd-fest-sparkle"
          style={
            {
              left: `${8 + ((i * 9) % 84)}%`,
              top: `${15 + (i % 4) * 18}%`,
              "--delay": `${i * 140}ms`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}
