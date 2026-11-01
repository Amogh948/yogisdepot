export const DELIVERY_UNAVAILABLE_MESSAGE =
  "Unfortunately, we are currently unavailable in this location, but we will be there soon!";

export const DELIVERY_POSTAL_NEEDED_MESSAGE =
  "Enter your postal code so we can confirm we deliver to this area.";

export type DeliveryArea = {
  postalCodePrefix?: string;
  city?: string;
  areaNames?: string[];
};

export type CoverageStatus = "unknown" | "open" | "unavailable" | "needs-postal";

export type CoveragePlace = {
  city?: string;
  label?: string;
  postalCode?: string;
};

function normalizePostal(value?: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeName(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** A Canadian FSA or full postal code, e.g. T2W or T2W 1A1. */
function postalToken(value?: string) {
  const compact = normalizePostal(value);
  return /^[A-Z]\d[A-Z]/.test(compact) ? compact : "";
}

function matchesPrefix(postal: string, areas: DeliveryArea[]) {
  return areas.some((area) => {
    const prefix = normalizePostal(area.postalCodePrefix);
    return prefix.length > 0 && postal.startsWith(prefix);
  });
}

/**
 * Compare a chosen place with the admin delivery areas.
 * No areas configured means delivery is open. A city we serve still needs a postal code.
 */
export function assessDeliveryCoverage(place: CoveragePlace | null, areas: DeliveryArea[]) {
  if (!place) return { status: "unknown" as const, message: null };
  if (!areas.length) return { status: "open" as const, message: null };

  const postal = postalToken(place.postalCode) || postalToken(place.city) || postalToken(place.label);
  if (postal) {
    return matchesPrefix(postal, areas)
      ? { status: "open" as const, message: null }
      : { status: "unavailable" as const, message: DELIVERY_UNAVAILABLE_MESSAGE };
  }

  const names = [place.city, place.label].map(normalizeName).filter(Boolean);
  const areaHit = areas.some((area) => (area.areaNames || []).some((name) => names.includes(normalizeName(name))));
  if (areaHit) return { status: "open" as const, message: null };

  const cityHit = areas.some((area) => names.includes(normalizeName(area.city)));
  if (cityHit) return { status: "needs-postal" as const, message: DELIVERY_POSTAL_NEEDED_MESSAGE };

  return { status: "unavailable" as const, message: DELIVERY_UNAVAILABLE_MESSAGE };
}
