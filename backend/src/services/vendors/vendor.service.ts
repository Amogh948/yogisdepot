import { ConflictError, ForbiddenError, NotFoundError } from "../../errors/AppError";
import { User } from "../../models/User";
import { Vendor, VendorDocument } from "../../models/Vendor";
import { notificationService } from "../notifications/notification.service";
import { slugify, uniqueSlug } from "../../utils/slug";
import { buildPagination, parsePagination } from "../../utils/pagination";

export const vendorService = {
  async apply(userId: string, input: {
    businessName: string;
    description?: string;
    email: string;
    phone: string;
    address: VendorDocument["address"];
    taxInformation?: string;
    bankInformation?: string;
    logo?: string;
    banner?: string;
  }) {
    const existing = await Vendor.findOne({ userId });
    if (existing) {
      throw new ConflictError("You already have a vendor application");
    }
    const slug = uniqueSlug(input.businessName);
    return Vendor.create({
      userId,
      businessName: input.businessName,
      slug,
      description: input.description,
      email: input.email,
      phone: input.phone,
      address: input.address,
      taxInformation: input.taxInformation,
      bankInformation: input.bankInformation,
      logo: input.logo,
      banner: input.banner,
      status: "pending",
      approvalStatus: "pending",
    });
  },

  async getMine(userId: string) {
    const vendor = await Vendor.findOne({ userId });
    if (!vendor) {
      throw new NotFoundError("Vendor profile not found");
    }
    return vendor;
  },

  async updateMine(userId: string, input: Partial<VendorDocument>) {
    const vendor = await Vendor.findOneAndUpdate({ userId }, input, { new: true });
    if (!vendor) {
      throw new NotFoundError("Vendor profile not found");
    }
    return vendor;
  },

  async list(query: { page?: number; limit?: number; status?: string; approvalStatus?: string; search?: string }) {
    const { page, limit, skip } = parsePagination(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
    if (query.search) {
      filter.businessName = { $regex: query.search, $options: "i" };
    }
    const [data, total] = await Promise.all([
      Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "firstName lastName email"),
      Vendor.countDocuments(filter),
    ]);
    return { data, pagination: buildPagination(page, limit, total) };
  },

  async getById(id: string) {
    const vendor = await Vendor.findById(id).populate("userId", "firstName lastName email phone");
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  },

  async getBySlug(slug: string) {
    const vendor = await Vendor.findOne({ slug, status: { $in: ["approved", "active"] } });
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  },

  async setStatus(
    id: string,
    input: { status: VendorDocument["status"]; rejectionReason?: string; commissionRate?: number },
  ) {
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    vendor.status = input.status;
    if (input.commissionRate !== undefined) {
      vendor.commissionRate = input.commissionRate;
    }
    if (input.status === "approved" || input.status === "active") {
      vendor.approvalStatus = "approved";
      vendor.status = input.status === "approved" ? "active" : input.status;
      await User.findByIdAndUpdate(vendor.userId, { role: "vendor" });
      await notificationService.notify({
        userId: vendor.userId,
        type: "vendor_approved",
        title: "Vendor application approved",
        body: `Your store ${vendor.businessName} is now live on Yogi's Depot.`,
      });
    }
    if (input.status === "rejected") {
      vendor.approvalStatus = "rejected";
      vendor.rejectionReason = input.rejectionReason;
      await notificationService.notify({
        userId: vendor.userId,
        type: "vendor_rejected",
        title: "Vendor application rejected",
        body: input.rejectionReason || "Your vendor application was not approved.",
      });
    }
    if (input.status === "suspended" || input.status === "inactive") {
      await User.findByIdAndUpdate(vendor.userId, { isActive: input.status !== "suspended" ? true : true });
    }
    await vendor.save();
    return vendor;
  },

  assertOwnership(vendorId: string, productVendorId: string): void {
    if (vendorId !== productVendorId) {
      throw new ForbiddenError("You can only manage your own products");
    }
  },

  slugFromName(name: string): string {
    return slugify(name);
  },
};
