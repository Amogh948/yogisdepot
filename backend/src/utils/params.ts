import { Request } from "express";
import { BadRequestError } from "../errors/AppError";

export function param(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new BadRequestError(`Missing route parameter ${key}`);
}
