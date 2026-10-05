import { Counter } from "../models/Counter";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.seq;
}

export async function nextProductCode(): Promise<string> {
  return `PRD-${pad(await nextSeq("product"), 6)}`;
}

export async function nextVariantCode(): Promise<string> {
  return `VAR-${pad(await nextSeq("variant"), 6)}`;
}

export async function nextOrderNumber(date = new Date()): Promise<string> {
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1, 2);
  const d = pad(date.getUTCDate(), 2);
  const dayKey = `order:${y}${m}${d}`;
  return `ORD-${y}${m}${d}-${pad(await nextSeq(dayKey), 6)}`;
}

/** Build a SKU code from brand/product/size tokens; caller must ensure uniqueness. */
export function buildSkuCode(parts: string[]): string {
  return parts
    .map((p) =>
      p
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 12),
    )
    .filter(Boolean)
    .join("-");
}
