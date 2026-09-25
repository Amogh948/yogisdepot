import { Response } from "express";
import { PaginationMeta } from "./pagination";

export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
  pagination?: PaginationMeta;
}

export interface ErrorBody {
  success: false;
  message: string;
  errors: unknown[];
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  pagination?: PaginationMeta,
): Response {
  const body: SuccessBody<T> = {
    success: true,
    message,
    data,
  };
  if (pagination) {
    body.pagination = pagination;
  }
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors: unknown[] = [],
): Response {
  const body: ErrorBody = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(body);
}
