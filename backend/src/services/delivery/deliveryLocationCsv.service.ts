import { parse } from "csv-parse/sync";
import { BadRequestError } from "../../errors/AppError";
import { deliveryLocationService } from "./deliveryLocation.service";

/** Canonical column keys used after header normalization. */
export const DELIVERY_CSV_HEADERS = [
  "areaNames",
  "postalCodePrefix",
  "deliveryFeeCents",
  "sameDayCutoffTime",
  "sameDayEnabled",
  "superfastDeliveryFeeCents",
  "city",
  "province",
  "isActive",
] as const;

export type DeliveryCsvHeader = (typeof DELIVERY_CSV_HEADERS)[number];

/** Human-readable headers written to the downloadable template. */
export const DELIVERY_CSV_TEMPLATE_HEADERS = [
  "Area Names",
  "Zip Code",
  "Delivery Fee (cents)",
  "Same-Day Delivery Cutoff",
  "Same-Day Enabled",
  "Superfast Delivery Fee (cents)",
  "City",
  "Province",
  "Active",
] as const;

/**
 * Maps normalized (lowercase, alphanumeric-only) header labels to canonical keys.
 * Accepts both the template labels and legacy camelCase column names.
 */
const HEADER_ALIASES: Record<string, DeliveryCsvHeader> = {
  areanames: "areaNames",
  areaname: "areaNames",
  area: "areaNames",
  postalcodeprefix: "postalCodePrefix",
  postalcode: "postalCodePrefix",
  zipcode: "postalCodePrefix",
  zip: "postalCodePrefix",
  deliveryfeecents: "deliveryFeeCents",
  deliveryfee: "deliveryFeeCents",
  samedaycutofftime: "sameDayCutoffTime",
  samedaydeliverycutoff: "sameDayCutoffTime",
  samedaycutoff: "sameDayCutoffTime",
  cutoff: "sameDayCutoffTime",
  samedayenabled: "sameDayEnabled",
  sameday: "sameDayEnabled",
  superfastdeliveryfeecents: "superfastDeliveryFeeCents",
  superfastdeliveryfee: "superfastDeliveryFeeCents",
  superfastfee: "superfastDeliveryFeeCents",
  city: "city",
  province: "province",
  isactive: "isActive",
  active: "isActive",
};

type CsvRow = Record<string, string>;

export type DeliveryCsvRowResult = {
  rowNumber: number;
  action: "create" | "update";
  postalCodePrefix?: string;
  ok: boolean;
  errors: string[];
};

function normalizeHeaderKey(header: string): string {
  return header.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeHeader(header: string): string {
  const trimmed = header.trim().replace(/^\uFEFF/, "");
  const alias = HEADER_ALIASES[normalizeHeaderKey(trimmed)];
  return alias || trimmed;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function parseCents(value: string | undefined, field: string, errors: string[]): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    errors.push(`${field} must be a non-negative integer in cents`);
    return undefined;
  }
  return n;
}

function areaNames(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split("|").map((part) => part.trim()).filter(Boolean))];
}

function rowValue(row: CsvRow, key: DeliveryCsvHeader): string | undefined {
  return row[key];
}

export const deliveryLocationCsvService = {
  templateCsv() {
    return `${DELIVERY_CSV_TEMPLATE_HEADERS.join(",")}
Woodbine|Woodlands,T2W,499,16:00,true,999,Calgary,AB,true
`;
  },

  async processCsv(buffer: Buffer, options: { commit: boolean }) {
    let records: CsvRow[];
    try {
      records = parse(buffer, {
        columns: (header: string[]) => header.map(normalizeHeader),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as CsvRow[];
    } catch {
      throw new BadRequestError("Could not read that CSV file");
    }
    if (!records.length) throw new BadRequestError("The CSV has no data rows");
    const headers = Object.keys(records[0] || {});
    if (!headers.includes("postalCodePrefix") || !headers.includes("areaNames")) {
      throw new BadRequestError(
        "CSV must include Zip Code (postalCodePrefix) and Area Names (areaNames) columns",
      );
    }

    const results: DeliveryCsvRowResult[] = [];
    let created = 0;
    let updated = 0;
    let failed = 0;
    const existingByPrefix = new Map(
      (await deliveryLocationService.listAdmin()).map((item) => [item.postalCodePrefix, item] as const),
    );

    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      const rowNumber = index + 2;
      const errors: string[] = [];
      const postalCodePrefix = rowValue(row, "postalCodePrefix")
        ?.trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const names = areaNames(rowValue(row, "areaNames"));
      const deliveryFeeCents = parseCents(rowValue(row, "deliveryFeeCents"), "deliveryFeeCents", errors);
      const superfastDeliveryFeeCents = parseCents(
        rowValue(row, "superfastDeliveryFeeCents"),
        "superfastDeliveryFeeCents",
        errors,
      );
      const sameDayCutoffRaw = rowValue(row, "sameDayCutoffTime")?.trim() || "";
      if (sameDayCutoffRaw && !/^([01]\d|2[0-3]):[0-5]\d$/.test(sameDayCutoffRaw)) {
        errors.push("sameDayCutoffTime must use HH:mm 24-hour time (e.g. 16:00)");
      }
      if (!postalCodePrefix) errors.push("postalCodePrefix (Zip Code) is required");
      if (!names.length) errors.push("areaNames is required. Separate names with |");

      const existing = postalCodePrefix ? existingByPrefix.get(postalCodePrefix) : undefined;
      if (!existing) {
        if (deliveryFeeCents == null) {
          errors.push("deliveryFeeCents (Delivery Fee) is required for a new area");
        }
        if (superfastDeliveryFeeCents == null) {
          errors.push("superfastDeliveryFeeCents is required for a new area");
        }
      }

      if (errors.length || !postalCodePrefix) {
        failed += 1;
        results.push({ rowNumber, action: existing ? "update" : "create", postalCodePrefix, ok: false, errors });
        continue;
      }

      const action = existing ? "update" : "create";
      const sameDayEnabledRaw = rowValue(row, "sameDayEnabled");
      const cityRaw = rowValue(row, "city");
      const provinceRaw = rowValue(row, "province");
      const isActiveRaw = rowValue(row, "isActive");

      if (!options.commit) {
        if (action === "create") {
          created += 1;
          existingByPrefix.set(postalCodePrefix, {
            _id: `preview-${postalCodePrefix}`,
            postalCodePrefix,
            isActive: parseBool(isActiveRaw, true),
          } as never);
        } else updated += 1;
        results.push({ rowNumber, action, postalCodePrefix, ok: true, errors: [] });
        continue;
      }

      try {
        if (existing) {
          // Blank optional cells keep the existing area values (fee, cutoff, flags).
          await deliveryLocationService.update(String(existing._id), {
            postalCodePrefix,
            areaNames: names,
            ...(deliveryFeeCents != null ? { deliveryFeeCents } : {}),
            ...(superfastDeliveryFeeCents != null ? { superfastDeliveryFeeCents } : {}),
            ...(sameDayCutoffRaw ? { sameDayCutoffTime: sameDayCutoffRaw } : {}),
            ...(sameDayEnabledRaw != null && sameDayEnabledRaw.trim() !== ""
              ? { sameDayEnabled: parseBool(sameDayEnabledRaw, true) }
              : {}),
            ...(cityRaw?.trim() ? { city: cityRaw.trim() } : {}),
            ...(provinceRaw?.trim() ? { province: provinceRaw.trim() } : {}),
            isActive: parseBool(isActiveRaw, existing.isActive),
          });
          updated += 1;
        } else {
          const createdRow = await deliveryLocationService.create({
            postalCodePrefix,
            areaNames: names,
            deliveryFeeCents: deliveryFeeCents!,
            superfastDeliveryFeeCents: superfastDeliveryFeeCents!,
            sameDayCutoffTime: sameDayCutoffRaw || "16:00",
            sameDayEnabled: parseBool(sameDayEnabledRaw, true),
            city: cityRaw?.trim() || undefined,
            province: provinceRaw?.trim() || undefined,
            isActive: parseBool(isActiveRaw, true),
          });
          existingByPrefix.set(postalCodePrefix, createdRow);
          created += 1;
        }
        results.push({ rowNumber, action, postalCodePrefix, ok: true, errors: [] });
      } catch (error) {
        failed += 1;
        results.push({
          rowNumber,
          action,
          postalCodePrefix,
          ok: false,
          errors: [error instanceof Error ? error.message : "Could not save this area"],
        });
      }
    }

    return {
      commit: options.commit,
      total: records.length,
      created,
      updated,
      failed,
      rows: results,
    };
  },
};
