/** Canadian postal: A1A 1A1 (optional single space). */
export const CA_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;

/** US ZIP or ZIP+4. */
export const US_ZIP_REGEX = /^\d{5}(-\d{4})?$/;

export function normalizePostalCode(value: string): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Format Canadian postal as A1A 1A1; leave other regions lightly cleaned. */
export function formatPostalCode(value: string, country?: string): string {
  const countryCode = (country || "Canada").trim().toUpperCase();
  const raw = String(value || "").toUpperCase();
  if (countryCode === "CA" || countryCode === "CAN" || countryCode === "CANADA" || !countryCode) {
    const compact = raw.replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (compact.length <= 3) return compact;
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }
  return raw.replace(/[^A-Z0-9-]/g, "").slice(0, 10);
}

export function isValidPostalCode(value: string, country?: string): boolean {
  const countryCode = (country || "Canada").trim().toUpperCase();
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (countryCode === "US" || countryCode === "USA" || countryCode === "UNITED STATES") {
    return US_ZIP_REGEX.test(trimmed);
  }
  // Default Canada (storefront market)
  return CA_POSTAL_REGEX.test(trimmed);
}

/** Value suitable for Square CardOptions.postalCode (Canadian spaced form). */
export function postalCodeForSquare(value: string, country?: string): string {
  return formatPostalCode(value, country || "Canada").trim();
}
