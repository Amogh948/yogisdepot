import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../config/constants";
import { UnauthorizedError } from "../errors/AppError";

export interface JwtPayload {
  userId: string;
  role: UserRole;
  jti: string;
}

export function signToken(userId: string, role: UserRole, jti: string): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign({ userId, role, jti }, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === "string") {
      throw new UnauthorizedError("Invalid token");
    }
    const payload = decoded as JwtPayload;
    if (!payload.userId || !payload.role || !payload.jti) {
      throw new UnauthorizedError("Invalid token payload");
    }
    return payload;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
