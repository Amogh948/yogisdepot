import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { CA_PROVINCES, CaProvince } from "../../models/CanadianTaxRate";
import { DeliveryLocation, DeliveryLocationDocument } from "../../models/DeliveryLocation";

export const UNDELIVERABLE_MESSAGE = "The product is undeliverable in this location.";

const PROVINCE_ALIASES: Record<string, CaProvince> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  newfoundland: "NL",
  "newfoundland and labrador": "NL",
  "nova scotia": "NS",
  "northwest territories": "NT",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  québec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
};

export type DeliveryAddressLike = {
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
};

export type DeliveryLocationInput = {
  postalCodePrefix: string;
  areaNames: string[];
  deliveryFeeCents: number;
  superfastDeliveryFeeCents: number;
  name?: string;
  country?: string;
  province?: string;
  city?: string;
  isActive?: boolean;
  sortOrder?: number;
};

function normalizeCountry(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
}

function isCanada(country?: string) {
  const value = normalizeCountry(country);
  return value === "canada" || value === "ca" || value === "can";
}

export function normalizeProvince(value?: string): CaProvince | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if ((CA_PROVINCES as readonly string[]).includes(upper)) {
    return upper as CaProvince;
  }
  const alias = PROVINCE_ALIASES[raw.toLowerCase()];
  return alias || null;
}

export function normalizePostal(value?: string) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizePrefix(value?: string) {
  return normalizePostal(value);
}

function normalizeAreaNames(names: string[] | string | undefined): string[] {
  const list = Array.isArray(names)
    ? names
    : String(names || "")
        .split(",")
        .map((part) => part.trim());
  return [...new Set(list.map((name) => name.trim()).filter(Boolean))];
}

function assertProvince(value?: string): CaProvince {
  const province = normalizeProvince(value || "AB");
  if (!province) {
    throw new BadRequestError("Province must be a valid Canadian province/territory code");
  }
  return province;
}

export const deliveryLocationService = {
  async listAdmin() {
    return DeliveryLocation.find().sort({ sortOrder: 1, postalCodePrefix: 1, name: 1 });
  },

  async listActive() {
    return DeliveryLocation.find({ isActive: true }).sort({ sortOrder: 1, postalCodePrefix: 1, name: 1 });
  },

  async get(id: string) {
    const row = await DeliveryLocation.findById(id);
    if (!row) throw new NotFoundError("Delivery location not found");
    return row;
  },

  async create(input: DeliveryLocationInput) {
    const postalCodePrefix = normalizePrefix(input.postalCodePrefix);
    if (!postalCodePrefix) {
      throw new BadRequestError("Postal code is required");
    }
    const areaNames = normalizeAreaNames(input.areaNames);
    if (!areaNames.length) {
      throw new BadRequestError("At least one area name is required");
    }
    if (input.deliveryFeeCents == null || input.deliveryFeeCents < 0) {
      throw new BadRequestError("Delivery fee must be zero or greater");
    }
    if (input.superfastDeliveryFeeCents == null || input.superfastDeliveryFeeCents < 0) {
      throw new BadRequestError("Superfast delivery fee must be zero or greater");
    }
    return DeliveryLocation.create({
      name: (input.name || postalCodePrefix).trim(),
      country: "Canada",
      province: assertProvince(input.province),
      city: input.city?.trim() || "Calgary",
      postalCodePrefix,
      areaNames,
      deliveryFeeCents: Math.round(input.deliveryFeeCents),
      superfastDeliveryFeeCents: Math.round(input.superfastDeliveryFeeCents),
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    });
  },

  async update(id: string, input: Partial<DeliveryLocationInput>) {
    const row = await this.get(id);
    if (input.postalCodePrefix !== undefined) {
      const postalCodePrefix = normalizePrefix(input.postalCodePrefix);
      if (!postalCodePrefix) throw new BadRequestError("Postal code is required");
      row.postalCodePrefix = postalCodePrefix;
      if (input.name === undefined) row.name = postalCodePrefix;
    }
    if (input.areaNames !== undefined) {
      const areaNames = normalizeAreaNames(input.areaNames);
      if (!areaNames.length) throw new BadRequestError("At least one area name is required");
      row.areaNames = areaNames;
    }
    if (input.deliveryFeeCents !== undefined) {
      if (input.deliveryFeeCents < 0) throw new BadRequestError("Delivery fee must be zero or greater");
      row.deliveryFeeCents = Math.round(input.deliveryFeeCents);
    }
    if (input.superfastDeliveryFeeCents !== undefined) {
      if (input.superfastDeliveryFeeCents < 0) {
        throw new BadRequestError("Superfast delivery fee must be zero or greater");
      }
      row.superfastDeliveryFeeCents = Math.round(input.superfastDeliveryFeeCents);
    }
    if (input.name !== undefined) row.name = input.name.trim() || row.postalCodePrefix;
    if (input.province !== undefined) row.province = assertProvince(input.province);
    if (input.city !== undefined) row.city = input.city.trim() || "Calgary";
    if (input.isActive !== undefined) row.isActive = input.isActive;
    if (input.sortOrder !== undefined) row.sortOrder = input.sortOrder;
    row.country = "Canada";
    await row.save();
    return row;
  },

  async remove(id: string) {
    const row = await DeliveryLocation.findByIdAndDelete(id);
    if (!row) throw new NotFoundError("Delivery location not found");
    return row;
  },

  matchesLocation(
    address: DeliveryAddressLike,
    location: {
      country: string;
      province?: string;
      postalCodePrefix?: string;
    },
  ) {
    if (!isCanada(address.country) || !isCanada(location.country)) return false;
    const prefix = normalizePrefix(location.postalCodePrefix);
    const postal = normalizePostal(address.postalCode);
    if (!prefix || !postal || !postal.startsWith(prefix)) return false;
    // Province is optional soft check when provided on both sides
    const addressProvince = normalizeProvince(address.state);
    const locationProvince = normalizeProvince(location.province);
    if (addressProvince && locationProvince && addressProvince !== locationProvince) {
      return false;
    }
    return true;
  },

  /** Best matching active location for an address (longest postal prefix wins). */
  async findMatchingLocation(address: DeliveryAddressLike): Promise<DeliveryLocationDocument | null> {
    const locations = await this.listActive();
    if (!locations.length) return null;
    const matches = locations.filter((location) => this.matchesLocation(address, location));
    if (!matches.length) return null;
    matches.sort(
      (a, b) =>
        normalizePrefix(b.postalCodePrefix).length - normalizePrefix(a.postalCodePrefix).length,
    );
    return matches[0];
  },

  /**
   * When no active locations exist, delivery is unrestricted (Canada market default).
   * When one or more exist, the address must match at least one by postal code.
   */
  async assertDeliverable(address: DeliveryAddressLike) {
    const locations = await this.listActive();
    if (!locations.length) return { deliverable: true as const, locations, match: null };

    if (!isCanada(address.country)) {
      throw new BadRequestError(UNDELIVERABLE_MESSAGE);
    }

    const match = await this.findMatchingLocation(address);
    if (!match) {
      throw new BadRequestError(UNDELIVERABLE_MESSAGE);
    }
    return { deliverable: true as const, locations, match };
  },

  async checkDeliverable(address: DeliveryAddressLike) {
    try {
      const result = await this.assertDeliverable(address);
      return {
        deliverable: true,
        message: null as string | null,
        deliveryFeeCents: result.match?.deliveryFeeCents ?? null,
        location: result.match
          ? {
              id: String(result.match._id),
              name: result.match.name,
              postalCodePrefix: result.match.postalCodePrefix,
              areaNames: result.match.areaNames,
              deliveryFeeCents: result.match.deliveryFeeCents,
            }
          : null,
      };
    } catch (error) {
      if (error instanceof BadRequestError && error.message === UNDELIVERABLE_MESSAGE) {
        return { deliverable: false, message: UNDELIVERABLE_MESSAGE, deliveryFeeCents: null, location: null };
      }
      throw error;
    }
  },
};
