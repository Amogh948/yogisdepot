import axios, { AxiosError } from "axios";
import type { ApiSuccess } from "../../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
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
