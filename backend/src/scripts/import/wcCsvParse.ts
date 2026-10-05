import fs from "fs";
import { parse } from "csv-parse/sync";
import { dollarsToCents } from "../../utils/money";
import { slugify } from "../../utils/slug";

export interface WooRow {
  raw: Record<string, string>;
  sourceId: string;
  type: string;
  published: boolean;
  featured: boolean;
  name: string;
  shortDescription: string;
  description: string;
  sku: string;
  gtin: string;
  taxStatus: string;
  taxClass: string;
  inStock: boolean;
  stock: number | null;
  lowStockAmount: number | null;
  regularPrice: number | null;
  salePrice: number | null;
  categoriesRaw: string;
  categoryLeaves: string[];
  tags: string[];
  brands: string;
  images: string[];
  parentSourceId: string;
  weightLbs: number | null;
}

export interface ParsedPriceCents {
  mrpCents: number;
  sellingPriceCents: number;
}

function cell(row: Record<string, string>, key: string): string {
  if (row[key] != null) return String(row[key]).trim();
  const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
  return found ? String(row[found] ?? "").trim() : "";
}

function parseBool01(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Split WooCommerce category lists; keep hierarchy leaf names. */
export function parseCategoryLeaves(categoriesRaw: string): string[] {
  if (!categoriesRaw.trim()) return [];
  const leaves: string[] = [];
  for (const part of categoriesRaw.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const leaf = piece.split(">").pop()?.trim() || piece;
    if (leaf) leaves.push(leaf);
  }
  return leaves;
}

/**
 * Prefer meaningful categories; drop Uncategorized when another exists.
 * Returns ordered unique leaves for mapping (first = primary).
 */
export function normalizeCategoriesForImport(leaves: string[]): string[] {
  const unique = [...new Set(leaves.map((l) => l.trim()).filter(Boolean))];
  const meaningful = unique.filter((l) => l.toLowerCase() !== "uncategorized");
  return meaningful.length > 0 ? meaningful : unique;
}

export function parseImageUrls(imagesRaw: string): { urls: string[]; invalid: string[] } {
  if (!imagesRaw.trim()) return { urls: [], invalid: [] };
  const parts = imagesRaw.split(/,\s*(?=https?:\/\/)/);
  const urls: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const u = part.trim();
    if (!u) continue;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        invalid.push(u);
        continue;
      }
      if (seen.has(parsed.href)) continue;
      seen.add(parsed.href);
      urls.push(parsed.href);
    } catch {
      invalid.push(u);
    }
  }
  return { urls, invalid };
}

export function parseTags(tagsRaw: string): string[] {
  if (!tagsRaw.trim()) return [];
  return [...new Set(tagsRaw.split(",").map((t) => t.trim()).filter(Boolean))];
}

export function normalizeParentSourceId(parent: string): string {
  if (!parent.trim()) return "";
  const m = parent.trim().match(/^(?:id:)?(\d+)$/i);
  return m ? m[1] : parent.trim();
}

export function deterministicSkuCode(sourceId: string): string {
  const digits = sourceId.replace(/\D/g, "") || sourceId;
  return `SKU-YD-${digits.padStart(6, "0")}`.toUpperCase();
}

export function deterministicSlug(name: string, sourceId: string): string {
  return `${slugify(name)}-wc-${sourceId}`.slice(0, 100);
}

export function priceToCents(
  regular: number | null,
  sale: number | null,
  sourceCurrency: string,
): ParsedPriceCents | { error: string } {
  if (sourceCurrency.toUpperCase() !== "CAD") {
    return { error: `Unsupported --source-currency=${sourceCurrency}. Only CAD is accepted.` };
  }
  if (regular == null || regular < 0) {
    return { error: "Missing or invalid regular price" };
  }
  const mrpCents = dollarsToCents(regular);
  if (sale != null) {
    if (sale < 0) return { error: "Sale price cannot be negative" };
    return { mrpCents, sellingPriceCents: dollarsToCents(sale) };
  }
  return { mrpCents, sellingPriceCents: mrpCents };
}

export function parseWooCsv(filePath: string): WooRow[] {
  const content = fs.readFileSync(filePath, "utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];

  return records.map((raw) => {
    const imagesRaw = cell(raw, "Images");
    const { urls } = parseImageUrls(imagesRaw);
    const categoriesRaw = cell(raw, "Categories");
    const parentRaw = cell(raw, "Parent");
    return {
      raw,
      sourceId: cell(raw, "ID"),
      type: (cell(raw, "Type") || "simple").toLowerCase(),
      published: parseBool01(cell(raw, "Published")),
      featured: parseBool01(cell(raw, "Is featured?")),
      name: cell(raw, "Name"),
      shortDescription: cell(raw, "Short description"),
      description: cell(raw, "Description") || cell(raw, "Short description") || cell(raw, "Name"),
      sku: cell(raw, "SKU"),
      gtin: cell(raw, "GTIN, UPC, EAN, or ISBN"),
      taxStatus: cell(raw, "Tax status"),
      taxClass: cell(raw, "Tax class"),
      inStock: parseBool01(cell(raw, "In stock?")),
      stock: parseNumber(cell(raw, "Stock")),
      lowStockAmount: parseNumber(cell(raw, "Low stock amount")),
      regularPrice: parseNumber(cell(raw, "Regular price")),
      salePrice: parseNumber(cell(raw, "Sale price")),
      categoriesRaw,
      categoryLeaves: parseCategoryLeaves(categoriesRaw),
      tags: parseTags(cell(raw, "Tags")),
      brands: cell(raw, "Brands"),
      images: urls,
      parentSourceId: normalizeParentSourceId(parentRaw),
      weightLbs: parseNumber(cell(raw, "Weight (lbs)")),
    };
  });
}

export function inventoryQuantity(row: WooRow): number {
  if (row.stock != null && row.stock >= 0) {
    return Math.trunc(row.stock);
  }
  // In stock but untracked → 0 (no unlimited invent)
  return 0;
}
