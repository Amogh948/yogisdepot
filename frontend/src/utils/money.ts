const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

/** Format a dollar amount (API still returns dollars for many fields). */
export function formatCad(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(Number(amount))) return cad.format(0);
  return cad.format(Number(amount));
}

/** Format integer cents as CAD. */
export function formatCadFromCents(cents: number | undefined | null): string {
  return formatCad((cents ?? 0) / 100);
}
