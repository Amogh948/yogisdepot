/** Authoritative CAD money helpers — integer cents only. */

export const CAD_CURRENCY = "CAD" as const;

/** Half-up rounding to nearest integer cent (or nearest integer when applying bps). */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

/** Apply basis points to an amount in cents. 1300 bps = 13%. */
export function applyBps(amountCents: number, rateBps: number): number {
  if (amountCents <= 0 || rateBps <= 0) return 0;
  return roundHalfUp((amountCents * rateBps) / 10_000);
}

export function addCents(...parts: number[]): number {
  return parts.reduce((sum, part) => sum + (Number.isFinite(part) ? Math.trunc(part) : 0), 0);
}

export function clampNonNegativeCents(value: number): number {
  return Math.max(0, Math.trunc(value));
}

/** Convert a legacy dollar float to cents (migration only). */
export function dollarsToCents(dollars: number): number {
  return roundHalfUp(dollars * 100);
}

export function centsToDollarsDisplay(cents: number): number {
  return Math.trunc(cents) / 100;
}
