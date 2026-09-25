import { CookieOptions, NextFunction, Request, Response } from "express";
import { COOKIE_NAME } from "../config/constants";
import { env, isProduction } from "../config/env";
import { UnauthorizedError } from "../errors/AppError";
import { TokenDenylist } from "../models/TokenDenylist";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { asyncHandler } from "../utils/asyncHandler";
import { verifyToken } from "../utils/jwt";

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    sameSite: isProduction ? "none" : "lax",
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function clearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction || env.COOKIE_SECURE,
    sameSite: isProduction ? "none" : "lax",
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    throw new UnauthorizedError("Authentication required");
  }

  const payload = verifyToken(token);
  const denied = await TokenDenylist.findOne({ jti: payload.jti }).lean();
  if (denied) {
    throw new UnauthorizedError("Token has been revoked");
  }

  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError("Account is inactive or does not exist");
  }

  const authUser = {
    id: user.id,
    role: user.role,
    vendorId: undefined as string | undefined,
  };

  if (user.role === "vendor") {
    const vendor = await Vendor.findOne({ userId: user._id, status: { $in: ["approved", "active"] } });
    if (vendor) {
      authUser.vendorId = vendor.id;
    }
  }

  req.user = authUser;
  next();
});

export const optionalAuthenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyToken(token);
    const denied = await TokenDenylist.findOne({ jti: payload.jti }).lean();
    if (denied) {
      next();
      return;
    }
    const user = await User.findById(payload.userId);
    if (user?.isActive) {
      req.user = { id: user.id, role: user.role };
      if (user.role === "vendor") {
        const vendor = await Vendor.findOne({ userId: user._id, status: { $in: ["approved", "active"] } });
        if (vendor) {
          req.user.vendorId = vendor.id;
        }
      }
    }
  } catch {
    // ignore invalid optional tokens
  }
  next();
});
