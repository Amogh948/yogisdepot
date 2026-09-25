import { UserRole } from "../config/constants";

export interface AuthUser {
  id: string;
  role: UserRole;
  vendorId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
