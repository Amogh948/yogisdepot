import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./jwt";
import { UnauthorizedError } from "../errors/AppError";

describe("JWT", () => {
  it("signs and verifies a payload", () => {
    const token = signToken("user-1", "customer", "jti-1");
    const payload = verifyToken(token);
    expect(payload.userId).toBe("user-1");
    expect(payload.role).toBe("customer");
    expect(payload.jti).toBe("jti-1");
  });

  it("rejects a tampered token", () => {
    expect(() => verifyToken("not-a-token")).toThrow(UnauthorizedError);
  });
});
