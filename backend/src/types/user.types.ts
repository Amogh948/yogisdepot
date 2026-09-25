import { UserRole } from "../config/constants";

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  vendorId?: string;
  createdAt: Date;
  updatedAt: Date;
}
