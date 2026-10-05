import mongoose, { ClientSession, Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { Inventory } from "../../models/Inventory";
import { InventoryReservation } from "../../models/InventoryReservation";
import { Warehouse } from "../../models/Warehouse";
import { DEFAULT_WAREHOUSE_CODE } from "../../config/constants";

async function defaultWarehouseId(): Promise<Types.ObjectId> {
  const wh = await Warehouse.findOne({ code: DEFAULT_WAREHOUSE_CODE, isActive: true });
  if (!wh) {
    throw new BadRequestError("Default warehouse is not configured");
  }
  return wh._id;
}

export const inventoryReservationService = {
  async availableQuantity(skuId: string, warehouseId?: Types.ObjectId): Promise<number> {
    const wid = warehouseId || (await defaultWarehouseId());
    const inv = await Inventory.findOne({ skuId, warehouseId: wid });
    return inv?.availableQuantity ?? 0;
  },

  /** Atomic: AVAILABLE → RESERVED. Does not permanently sell. */
  async reserve(input: {
    skuId: string;
    quantity: number;
    orderId: Types.ObjectId;
    orderNumber: string;
    warehouseId?: Types.ObjectId;
    session?: ClientSession;
  }) {
    const warehouseId = input.warehouseId || (await defaultWarehouseId());
    const opts = input.session ? { session: input.session } : {};
    const updated = await Inventory.findOneAndUpdate(
      { skuId: input.skuId, warehouseId, availableQuantity: { $gte: input.quantity } },
      { $inc: { availableQuantity: -input.quantity, reservedQuantity: input.quantity } },
      { new: true, ...opts },
    );
    if (!updated) {
      throw new BadRequestError("Insufficient inventory to reserve");
    }
    const [reservation] = await InventoryReservation.create(
      [
        {
          skuId: input.skuId,
          warehouseId,
          quantity: input.quantity,
          status: "reserved",
          orderId: input.orderId,
          orderNumber: input.orderNumber,
        },
      ],
      opts,
    );
    return reservation;
  },

  /** RESERVED → SOLD */
  async markSold(orderId: string, session?: ClientSession) {
    const opts = session ? { session } : {};
    const reservations = await InventoryReservation.find({ orderId, status: "reserved" }).session(
      session || null,
    );
    for (const reservation of reservations) {
      const updated = await Inventory.findOneAndUpdate(
        {
          skuId: reservation.skuId,
          warehouseId: reservation.warehouseId,
          reservedQuantity: { $gte: reservation.quantity },
        },
        { $inc: { reservedQuantity: -reservation.quantity } },
        { new: true, ...opts },
      );
      if (!updated) {
        throw new BadRequestError("Unable to finalize inventory sale");
      }
      reservation.status = "sold";
      await reservation.save(opts);
    }
  },

  /** RESERVED → RELEASED (cancel / expire) */
  async releaseForOrder(orderId: string, session?: ClientSession) {
    const opts = session ? { session } : {};
    const reservations = await InventoryReservation.find({
      orderId,
      status: "reserved",
    }).session(session || null);
    for (const reservation of reservations) {
      const updated = await Inventory.findOneAndUpdate(
        {
          skuId: reservation.skuId,
          warehouseId: reservation.warehouseId,
          reservedQuantity: { $gte: reservation.quantity },
        },
        { $inc: { availableQuantity: reservation.quantity, reservedQuantity: -reservation.quantity } },
        { new: true, ...opts },
      );
      if (!updated) {
        throw new BadRequestError("Unable to release inventory reservation");
      }
      reservation.status = "released";
      await reservation.save(opts);
    }
  },

  async expireStale(now = new Date()) {
    const stale = await InventoryReservation.find({
      status: "reserved",
      expiresAt: { $lte: now },
    });
    for (const reservation of stale) {
      await Inventory.findOneAndUpdate(
        {
          skuId: reservation.skuId,
          warehouseId: reservation.warehouseId,
          reservedQuantity: { $gte: reservation.quantity },
        },
        { $inc: { availableQuantity: reservation.quantity, reservedQuantity: -reservation.quantity } },
      );
      reservation.status = "expired";
      await reservation.save();
    }
    return stale.length;
  },

  async ensureStockRow(input: {
    skuId: string | Types.ObjectId;
    skuCode: string;
    warehouseId: Types.ObjectId;
    warehouseCode: string;
    quantity: number;
  }) {
    return Inventory.findOneAndUpdate(
      { skuId: input.skuId, warehouseId: input.warehouseId },
      {
        $setOnInsert: {
          skuCode: input.skuCode,
          warehouseCode: input.warehouseCode,
          reservedQuantity: 0,
          damagedQuantity: 0,
          reorderLevel: 10,
          reorderQuantity: 50,
        },
        $inc: { availableQuantity: input.quantity },
      },
      { upsert: true, new: true },
    );
  },

  async getWarehouseOrThrow(code = DEFAULT_WAREHOUSE_CODE) {
    const wh = await Warehouse.findOne({ code, isActive: true });
    if (!wh) throw new NotFoundError("Warehouse not found");
    return wh;
  },

  withSession: mongoose.startSession.bind(mongoose),
};
