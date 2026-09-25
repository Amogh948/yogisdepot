import { describe, expect, it } from "vitest";
import { hashPassword, comparePassword } from "../utils/password";
import { slugify } from "../utils/slug";
import { buildPagination, parsePagination } from "../utils/pagination";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("Password@123");
    expect(hash).not.toBe("Password@123");
    await expect(comparePassword("Password@123", hash)).resolves.toBe(true);
    await expect(comparePassword("wrong", hash)).resolves.toBe(false);
  });
});

describe("slugify", () => {
  it("creates url-safe slugs", () => {
    expect(slugify("Masala Potato Chips")).toBe("masala-potato-chips");
  });
});

describe("pagination", () => {
  it("caps limit and computes skip", () => {
    const parsed = parsePagination({ page: 2, limit: 500 });
    expect(parsed.limit).toBe(100);
    expect(parsed.skip).toBe(100);
    expect(buildPagination(2, 20, 55)).toEqual({ page: 2, limit: 20, total: 55, totalPages: 3 });
  });
});
