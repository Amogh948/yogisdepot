import { parse } from "csv-parse/sync";
import { BadRequestError } from "../../errors/AppError";
import { deliveryLocationService } from "./deliveryLocation.service";

export const DELIVERY_CSV_HEADERS = [
  "postalCodePrefix",
  "areaNames",
  "deliveryFeeCents",
  "superfastDeliveryFeeCents",
  "city",
  "province",
  "isActive",
] as const;

type CsvRow = Record<string, string>;

export type DeliveryCsvRowResult = {
  rowNumber: number;
  action: "create" | "update";
  postalCodePrefix?: string;
  ok: boolean;
  errors: string[];
};

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

export const deliveryLocationCsvService = {
  templateCsv() {
    return `${DELIVERY_CSV_HEADERS.join(",")}
T2W,Woodbine|Woodlands,499,999,Calgary,AB,true
`;
  },

  async processCsv(buffer: Buffer, options: { commit: boolean }) {
    let records: CsvRow[];
    try {
      records = parse(buffer, {
        columns: (header: string[]) => header.map((column) => column.trim()),
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
      throw new BadRequestError("CSV must include postalCodePrefix and areaNames columns");
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
      const postalCodePrefix = row.postalCodePrefix?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const names = areaNames(row.areaNames);
      const deliveryFeeCents = parseCents(row.deliveryFeeCents, "deliveryFeeCents", errors);
      const superfastDeliveryFeeCents = parseCents(row.superfastDeliveryFeeCents, "superfastDeliveryFeeCents", errors);
      if (!postalCodePrefix) errors.push("postalCodePrefix is required");
      if (!names.length) errors.push("areaNames is required. Separate names with |");

      const existing = postalCodePrefix ? existingByPrefix.get(postalCodePrefix) : undefined;
      if (!existing) {
        if (deliveryFeeCents == null) errors.push("deliveryFeeCents is required for a new area");
        if (superfastDeliveryFeeCents == null) errors.push("superfastDeliveryFeeCents is required for a new area");
      }

      if (errors.length || !postalCodePrefix) {
        failed += 1;
        results.push({ rowNumber, action: existing ? "update" : "create", postalCodePrefix, ok: false, errors });
        continue;
      }

      const action = existing ? "update" : "create";
      if (!options.commit) {
        if (action === "create") {
          created += 1;
          existingByPrefix.set(postalCodePrefix, {
            _id: `preview-${postalCodePrefix}`,
            postalCodePrefix,
            isActive: parseBool(row.isActive, true),
          } as never);
        } else updated += 1;
        results.push({ rowNumber, action, postalCodePrefix, ok: true, errors: [] });
        continue;
      }

      try {
        if (existing) {
          await deliveryLocationService.update(String(existing._id), {
            postalCodePrefix,
            areaNames: names,
            ...(deliveryFeeCents != null ? { deliveryFeeCents } : {}),
            ...(superfastDeliveryFeeCents != null ? { superfastDeliveryFeeCents } : {}),
            ...(row.city?.trim() ? { city: row.city.trim() } : {}),
            ...(row.province?.trim() ? { province: row.province.trim() } : {}),
            isActive: parseBool(row.isActive, existing.isActive),
          });
          updated += 1;
        } else {
          const createdRow = await deliveryLocationService.create({
            postalCodePrefix,
            areaNames: names,
            deliveryFeeCents: deliveryFeeCents!,
            superfastDeliveryFeeCents: superfastDeliveryFeeCents!,
            city: row.city?.trim() || undefined,
            province: row.province?.trim() || undefined,
            isActive: parseBool(row.isActive, true),
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
