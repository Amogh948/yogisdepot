export const FESTIVAL_THEMES = ["diwali", "navratri", "holi", "eid", "generic"] as const;
export type FestivalTheme = (typeof FESTIVAL_THEMES)[number];

export const FESTIVAL_THEME_OPTIONS: Array<{ value: FestivalTheme; label: string }> = [
  { value: "diwali", label: "Diwali — lights & firecrackers" },
  { value: "navratri", label: "Navratri — nine colours & Durga" },
  { value: "holi", label: "Holi — colour powder" },
  { value: "eid", label: "Eid — lanterns & crescent" },
  { value: "generic", label: "Generic festive sparkle" },
];

export type FestivalPalette = {
  /** Page wash / background */
  bg: string;
  /** Secondary wash (gradient end) */
  bgAlt: string;
  /** Hero gradient fallback when no image */
  heroFrom: string;
  heroTo: string;
  /** Titles / accent text */
  accent: string;
  /** Buttons, highlights, borders */
  highlight: string;
  /** Soft card surface */
  card: string;
  /** Muted text on themed surfaces */
  muted: string;
  /** Pattern opacity hint */
  pattern: string;
};

export const FESTIVAL_PALETTES: Record<FestivalTheme, FestivalPalette> = {
  diwali: {
    bg: "#2A1810",
    bgAlt: "#1A1028",
    heroFrom: "#1A1028",
    heroTo: "#3D1F0F",
    accent: "#FECA57",
    highlight: "#D85B0B",
    card: "#FFF8EC",
    muted: "#E8D5B5",
    pattern: "rgba(254, 202, 87, 0.14)",
  },
  navratri: {
    bg: "#FFF4D6",
    bgAlt: "#FFE8A3",
    heroFrom: "#FFB703",
    heroTo: "#FB8500",
    accent: "#8B1E3F",
    highlight: "#C1121F",
    card: "#FFFBF0",
    muted: "#6B3A2A",
    pattern: "rgba(255, 215, 0, 0.22)",
  },
  holi: {
    bg: "#FFF0F5",
    bgAlt: "#E8F4FF",
    heroFrom: "#FF6B6B",
    heroTo: "#54A0FF",
    accent: "#5F27CD",
    highlight: "#FF9FF3",
    card: "#FFFFFF",
    muted: "#5A4A6A",
    pattern: "rgba(255, 159, 243, 0.18)",
  },
  eid: {
    bg: "#0F241C",
    bgAlt: "#183C2B",
    heroFrom: "#0B1F17",
    heroTo: "#2A4A28",
    accent: "#FECA57",
    highlight: "#C9A227",
    card: "#F4F7F2",
    muted: "#C5D4C8",
    pattern: "rgba(254, 202, 87, 0.12)",
  },
  generic: {
    bg: "#EEF7F1",
    bgAlt: "#F3E7D3",
    heroFrom: "#183C2B",
    heroTo: "#287A43",
    accent: "#183C2B",
    highlight: "#D85B0B",
    card: "#FFFFFF",
    muted: "#6F6A63",
    pattern: "rgba(40, 122, 67, 0.1)",
  },
};

/** Infer theme from slug/name when admin has not set festivalTheme. */
export function inferFestivalTheme(slugOrName: string | undefined | null): FestivalTheme {
  const raw = String(slugOrName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  if (!raw.trim()) return "generic";
  if (/\bdiwali\b|\bdeepavali\b|\blights?\b/.test(raw)) return "diwali";
  if (/\bnavratri\b|\bdurga\b|\bgarba\b|\bduss?ehra\b/.test(raw)) return "navratri";
  if (/\bholi\b|\bcolour\b|\bcolor\b/.test(raw)) return "holi";
  if (/\beid\b|\bramadan\b|\bcrescent\b/.test(raw)) return "eid";
  return "generic";
}

export function resolveFestivalTheme(
  explicit: string | undefined | null,
  slug?: string,
  name?: string,
): FestivalTheme {
  if (explicit && (FESTIVAL_THEMES as readonly string[]).includes(explicit)) {
    return explicit as FestivalTheme;
  }
  const fromSlug = inferFestivalTheme(slug);
  if (fromSlug !== "generic") return fromSlug;
  return inferFestivalTheme(name);
}

export function festivalThemeCssVars(theme: FestivalTheme): Record<string, string> {
  const p = FESTIVAL_PALETTES[theme];
  return {
    "--fest-bg": p.bg,
    "--fest-bg-alt": p.bgAlt,
    "--fest-hero-from": p.heroFrom,
    "--fest-hero-to": p.heroTo,
    "--fest-accent": p.accent,
    "--fest-highlight": p.highlight,
    "--fest-card": p.card,
    "--fest-muted": p.muted,
    "--fest-pattern": p.pattern,
  };
}
