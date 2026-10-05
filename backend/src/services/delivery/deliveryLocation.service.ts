import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { CA_PROVINCES, CaProvince } from "../../models/CanadianTaxRate";
import { DeliveryLocation } from "../../models/DeliveryLocation";

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
  name: string;
  country?: string;
  province: string;
  city?: string;
  postalCodePrefix?: string;
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

function normalizeCity(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePrefix(value?: string) {
  const compact = normalizePostal(value);
  return compact || "";
}

function assertProvince(value: string): CaProvince {
  const province = normalizeProvince(value);
  if (!province) {
    throw new BadRequestError("Province must be a valid Canadian province/territory code");
  }
  return province;
}

export const deliveryLocationService = {
  async listAdmin() {
    return DeliveryLocation.find().sort({ sortOrder: 1, province: 1, name: 1 });
  },

  async listActive() {
    return DeliveryLocation.find({ isActive: true }).sort({ sortOrder: 1, province: 1, name: 1 });
  },

  async get(id: string) {
    const row = await DeliveryLocation.findById(id);
    if (!row) throw new NotFoundError("Delivery location not found");
    return row;
  },

  async create(input: DeliveryLocationInput) {
    return DeliveryLocation.create({
      name: input.name.trim(),
      country: "Canada",
      province: assertProvince(input.province),
      city: input.city?.trim() || undefined,
      postalCodePrefix: normalizePrefix(input.postalCodePrefix) || undefined,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    });
  },

  async update(id: string, input: Partial<DeliveryLocationInput>) {
    const row = await this.get(id);
    if (input.name !== undefined) row.name = input.name.trim();
    if (input.province !== undefined) row.province = assertProvince(input.province);
    if (input.city !== undefined) row.city = input.city.trim() || undefined;
    if (input.postalCodePrefix !== undefined) {
      row.postalCodePrefix = normalizePrefix(input.postalCodePrefix) || undefined;
    }
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
      province: string;
      city?: string;
      postalCodePrefix?: string;
    },
  ) {
    if (!isCanada(address.country) || !isCanada(location.country)) return false;
    const addressProvince = normalizeProvince(address.state);
    const locationProvince = normalizeProvince(location.province);
    if (!addressProvince || !locationProvince || addressProvince !== locationProvince) {
      return false;
    }
    if (location.city) {
      if (normalizeCity(address.city) !== normalizeCity(location.city)) return false;
    }
    if (location.postalCodePrefix) {
      const prefix = normalizePrefix(location.postalCodePrefix);
      const postal = normalizePostal(address.postalCode);
      if (!prefix || !postal.startsWith(prefix)) return false;
    }
    return true;
  },

  /**
   * When no active locations exist, delivery is unrestricted (Canada market default).
   * When one or more exist, the address must match at least one.
   */
  async assertDeliverable(address: DeliveryAddressLike) {
    const locations = await this.listActive();
    if (!locations.length) return { deliverable: true as const, locations };

    if (!isCanada(address.country)) {
      throw new BadRequestError(UNDELIVERABLE_MESSAGE);
    }

    const ok = locations.some((location) => this.matchesLocation(address, location));
    if (!ok) {
      throw new BadRequestError(UNDELIVERABLE_MESSAGE);
    }
    return { deliverable: true as const, locations };
  },

  async checkDeliverable(address: DeliveryAddressLike) {
    try {
      await this.assertDeliverable(address);
      return { deliverable: true, message: null as string | null };
    } catch (error) {
      if (error instanceof BadRequestError && error.message === UNDELIVERABLE_MESSAGE) {
        return { deliverable: false, message: UNDELIVERABLE_MESSAGE };
      }
      throw error;
    }
  },
};
