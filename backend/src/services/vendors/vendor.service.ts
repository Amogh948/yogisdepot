import { ConflictError, BadRequestError, ForbiddenError, NotFoundError } from "../../errors/AppError";
import { Product } from "../../models/Product";
import { User } from "../../models/User";
import { Vendor, VendorDocument } from "../../models/Vendor";
import { hashPassword } from "../../utils/password";
import { notificationService } from "../notifications/notification.service";
import { slugify, uniqueSlug } from "../../utils/slug";
import { buildPagination, parsePagination } from "../../utils/pagination";

export type AdminVendorCreateInput = {
  businessName: string;
  description?: string;
  email: string;
  phone: string;
  address: VendorDocument["address"];
  taxInformation?: string;
  bankInformation?: string;
  logo?: string;
  banner?: string;
  firstName: string;
  lastName: string;
  password?: string;
  commissionRate?: number;
  status?: VendorDocument["status"];
};

export type AdminVendorUpdateInput = Partial<{
  businessName: string;
  description: string;
  email: string;
  phone: string;
  address: VendorDocument["address"];
  taxInformation: string;
  bankInformation: string;
  logo: string;
  banner: string;
  commissionRate: number;
  status: VendorDocument["status"];
}>;

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

  async createByAdmin(input: AdminVendorCreateInput) {
    const email = input.email.toLowerCase().trim();
    let user = await User.findOne({ email });
    if (user) {
      const existingVendor = await Vendor.findOne({ userId: user._id });
      if (existingVendor) {
        throw new ConflictError("A vendor already exists for this account email");
      }
      user.role = "vendor";
      user.firstName = input.firstName;
      user.lastName = input.lastName;
      user.phone = input.phone;
      user.isActive = true;
      await user.save();
    } else {
      const password = await hashPassword(input.password || "Password@123");
      user = await User.create({
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        phone: input.phone,
        password,
        role: "vendor",
        isActive: true,
        isEmailVerified: true,
      });
    }

    const status = input.status || "active";
    const vendor = await Vendor.create({
      userId: user._id,
      businessName: input.businessName,
      slug: uniqueSlug(input.businessName),
      description: input.description,
      email,
      phone: input.phone,
      address: {
        ...input.address,
        country: input.address.country || "Canada",
      },
      taxInformation: input.taxInformation,
      bankInformation: input.bankInformation,
      logo: input.logo,
      banner: input.banner,
      commissionRate: input.commissionRate ?? 10,
      status: status === "approved" ? "active" : status,
      approvalStatus: status === "rejected" ? "rejected" : status === "pending" ? "pending" : "approved",
    });

    return this.getById(String(vendor._id));
  },

  async updateByAdmin(id: string, input: AdminVendorUpdateInput) {
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }

    if (input.businessName !== undefined && input.businessName !== vendor.businessName) {
      vendor.businessName = input.businessName;
      vendor.slug = uniqueSlug(input.businessName);
    }
    if (input.description !== undefined) vendor.description = input.description;
    if (input.email !== undefined) vendor.email = input.email.toLowerCase().trim();
    if (input.phone !== undefined) vendor.phone = input.phone;
    if (input.address !== undefined) {
      vendor.address = {
        ...input.address,
        country: input.address.country || "Canada",
      };
    }
    if (input.taxInformation !== undefined) vendor.taxInformation = input.taxInformation;
    if (input.bankInformation !== undefined) vendor.bankInformation = input.bankInformation;
    if (input.logo !== undefined) vendor.logo = input.logo;
    if (input.banner !== undefined) vendor.banner = input.banner;
    if (input.commissionRate !== undefined) vendor.commissionRate = input.commissionRate;

    if (input.status !== undefined) {
      vendor.status = input.status === "approved" ? "active" : input.status;
      if (input.status === "rejected") vendor.approvalStatus = "rejected";
      else if (input.status === "pending") vendor.approvalStatus = "pending";
      else vendor.approvalStatus = "approved";
    }

    await vendor.save();
    return this.getById(id);
  },

  async remove(id: string) {
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    const productCount = await Product.countDocuments({ vendorId: vendor._id });
    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete vendor with ${productCount} product${productCount === 1 ? "" : "s"}. Remove or reassign products first.`,
      );
    }
    await Vendor.deleteOne({ _id: vendor._id });
    const user = await User.findById(vendor.userId);
    if (user && user.role === "vendor") {
      user.role = "customer";
      await user.save();
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
