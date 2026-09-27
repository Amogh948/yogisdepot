import axios, { AxiosError } from "axios";
import type { ApiSuccess } from "../../types";

/** Accepts `/api/v1`, `https://api.yogisdepot.com`, or `https://api.yogisdepot.com/api/v1`. */
export function apiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || "/api/v1").trim().replace(/\/+$/, "");
  if (raw.endsWith("/api/v1")) return raw;
  return `${raw}/api/v1`;
}

export const api = axios.create({
  baseURL: apiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export class ApiError extends Error {
  status: number;
  errors: unknown[];

  constructor(message: string, status = 400, errors: unknown[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: unknown[] }>) => {
    const message = error.response?.data?.message || error.message || "Request failed";
    throw new ApiError(message, error.response?.status, error.response?.data?.errors);
  },
);

export async function unwrap<T>(promise: Promise<{ data: ApiSuccess<T> }>): Promise<ApiSuccess<T>> {
  const response = await promise;
  return response.data;
}
