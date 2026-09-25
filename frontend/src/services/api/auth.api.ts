import type { User } from "../../types";
import { api, unwrap } from "./client";

export const authApi = {
  register: (payload: Record<string, string>) => unwrap<User>(api.post("/auth/register", payload)),
  login: (payload: { email: string; password: string; guestCart?: Array<{ productId: string; quantity: number }> }) =>
    unwrap<User>(api.post("/auth/login", payload)),
  logout: () => unwrap<null>(api.post("/auth/logout")),
  me: () => unwrap<User>(api.get("/auth/me")),
  changePassword: (payload: Record<string, string>) => unwrap<null>(api.patch("/auth/password", payload)),
  updateProfile: (payload: Record<string, string>) => unwrap<User>(api.patch("/auth/profile", payload)),
};
