import { NextFunction, Request, Response } from "express";
import { UserRole } from "../config/constants";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError("You do not have permission to perform this action"));
      return;
    }
    next();
  };
}

export function requireVendor(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }
  if (req.user.role !== "vendor" || !req.user.vendorId) {
    next(new ForbiddenError("Approved vendor account required"));
    return;
  }
  next();
}
