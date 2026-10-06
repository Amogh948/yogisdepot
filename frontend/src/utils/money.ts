const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string) {
  const code = (currency || "CAD").toUpperCase();
  let fmt = formatters.get(code);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-CA", { style: "currency", currency: code });
    formatters.set(code, fmt);
  }
  return fmt;
}

/** Format a dollar amount using the given ISO currency (defaults to CAD). */
export function formatMoney(amount: number | undefined | null, currency = "CAD"): string {
  if (amount == null || Number.isNaN(Number(amount))) return formatterFor(currency).format(0);
  return formatterFor(currency).format(Number(amount));
}

/** Format integer cents using the given ISO currency. */
export function formatMoneyFromCents(cents: number | undefined | null, currency = "CAD"): string {
  return formatMoney((cents ?? 0) / 100, currency);
}

/** @deprecated Prefer formatMoney with configured currency */
export function formatCad(amount: number | undefined | null): string {
  return formatMoney(amount, "CAD");
}

/** @deprecated Prefer formatMoneyFromCents with configured currency */
export function formatCadFromCents(cents: number | undefined | null): string {
  return formatMoneyFromCents(cents, "CAD");
}
