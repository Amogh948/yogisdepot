import { NotFoundError } from "../../errors/AppError";
import { Address } from "../../models/Address";

export const addressService = {
  async list(customerId: string) {
    return Address.find({ customerId }).sort({ isDefault: -1, createdAt: -1 });
  },

  async create(customerId: string, input: Record<string, unknown>) {
    if (input.isDefault) {
      await Address.updateMany({ customerId }, { isDefault: false });
    }
    const count = await Address.countDocuments({ customerId });
    return Address.create({
      ...input,
      customerId,
      isDefault: input.isDefault === true || count === 0,
    });
  },

  async update(customerId: string, id: string, input: Record<string, unknown>) {
    if (input.isDefault) {
      await Address.updateMany({ customerId }, { isDefault: false });
    }
    const address = await Address.findOneAndUpdate({ _id: id, customerId }, input, { new: true });
    if (!address) {
      throw new NotFoundError("Address not found");
    }
    return address;
  },

  async remove(customerId: string, id: string) {
    const address = await Address.findOneAndDelete({ _id: id, customerId });
    if (!address) {
      throw new NotFoundError("Address not found");
    }
    if (address.isDefault) {
      const next = await Address.findOne({ customerId });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }
    return address;
  },

  async getOwned(customerId: string, id: string) {
    const address = await Address.findOne({ _id: id, customerId });
    if (!address) {
      throw new NotFoundError("Address not found");
    }
    return address;
  },
};
