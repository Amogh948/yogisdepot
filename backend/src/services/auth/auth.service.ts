import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { COOKIE_NAME } from "../../config/constants";
import { ConflictError, UnauthorizedError } from "../../errors/AppError";
import { TokenDenylist } from "../../models/TokenDenylist";
import { User, UserDocument } from "../../models/User";
import { Vendor } from "../../models/Vendor";
import { PublicUser } from "../../types/user.types";
import { signToken, verifyToken } from "../../utils/jwt";
import { comparePassword, hashPassword } from "../../utils/password";
import { cookieOptions } from "../../middleware/auth.middleware";
import { Response } from "express";
import { Cart } from "../../models/Cart";

export function toPublicUser(user: UserDocument, vendorId?: string): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatar: user.avatar,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    vendorId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const authService = {
  async register(input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<UserDocument> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }
    const password = await hashPassword(input.password);
    return User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      password,
      role: "customer",
    });
  },

  async login(email: string, password: string): Promise<UserDocument> {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }
    const matches = await comparePassword(password, user.password);
    if (!matches) {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (!user.isActive) {
      throw new UnauthorizedError("This account has been deactivated");
    }
    return user;
  },

  async issueSession(res: Response, user: UserDocument): Promise<void> {
    const jti = randomUUID();
    const token = signToken(user.id, user.role, jti);
    res.cookie(COOKIE_NAME, token, cookieOptions());
  },

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    try {
      const payload = verifyToken(token);
      const decoded = jwt.decode(token);
      const exp =
        decoded && typeof decoded !== "string" && decoded.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await TokenDenylist.create({ jti: payload.jti, expiresAt: exp });
    } catch {
      // already invalid
    }
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    const vendor = await Vendor.findOne({ userId: user._id });
    return toPublicUser(user, vendor?.id);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    const matches = await comparePassword(currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedError("Current password is incorrect");
    }
    user.password = await hashPassword(newPassword);
    await user.save();
  },

  async updateProfile(
    userId: string,
    input: { firstName?: string; lastName?: string; phone?: string; avatar?: string },
  ): Promise<PublicUser> {
    const user = await User.findByIdAndUpdate(userId, input, { new: true });
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    const vendor = await Vendor.findOne({ userId: user._id });
    return toPublicUser(user, vendor?.id);
  },

  async mergeGuestCart(userId: string, items: Array<{ productId: string; quantity: number }>): Promise<void> {
    if (items.length === 0) {
      return;
    }
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    for (const incoming of items) {
      const existing = cart.items.find((item) => String(item.productId) === incoming.productId);
      if (existing) {
        existing.quantity += incoming.quantity;
      } else {
        cart.items.push({ productId: incoming.productId as unknown as never, quantity: incoming.quantity });
      }
    }
    await cart.save();
  },
};
