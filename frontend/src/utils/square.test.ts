import { describe, expect, it, vi } from "vitest";
import {
  assertVerificationDetails,
  centsToSquareAmount,
  squareSdkUrl,
  tokenizeCard,
  tokenizeFailureMessage,
  toSquareCountryCode,
  type SquareVerificationDetails,
} from "./square";

const baseDetails: SquareVerificationDetails = {
  amount: "44.47",
  currencyCode: "CAD",
  intent: "CHARGE",
  customerInitiated: true,
  sellerKeyedIn: false,
  billingContact: {
    givenName: "Amogh",
    familyName: "MK",
    email: "customer@example.com",
    phone: "4035550100",
    addressLines: ["123 Main St"],
    city: "Calgary",
    state: "AB",
    postalCode: "T2Z0A1",
    countryCode: "CA",
  },
};

describe("square helpers", () => {
  it("uses sandbox/production SDK script URLs", () => {
    expect(squareSdkUrl("sandbox")).toBe("https://sandbox.web.squarecdn.com/v1/square.js");
    expect(squareSdkUrl("production")).toBe("https://web.squarecdn.com/v1/square.js");
  });

  it("formats cents for Square verification amount", () => {
    expect(centsToSquareAmount(4447)).toBe("44.47");
  });

  it("normalizes Canada country codes", () => {
    expect(toSquareCountryCode("Canada")).toBe("CA");
    expect(toSquareCountryCode("ca")).toBe("CA");
  });
});

describe("tokenizeCard", () => {
  it("requires verificationDetails and calls Card.tokenize with them (SCA path)", async () => {
    const tokenize = vi.fn().mockResolvedValue({ status: "OK", token: "tok_ok" });
    const result = await tokenizeCard({ tokenize }, baseDetails);
    expect(result).toEqual({ sourceId: "tok_ok" });
    expect(tokenize).toHaveBeenCalledOnce();
    expect(tokenize).toHaveBeenCalledWith(baseDetails);
  });

  it("treats challenge cancel as a failed tokenize (no backend charge)", async () => {
    const tokenize = vi.fn().mockResolvedValue({ status: "Cancel" });
    await expect(tokenizeCard({ tokenize }, baseDetails)).rejects.toThrow(/cancell?ed/i);
  });

  it("fails when verification details are incomplete", async () => {
    const tokenize = vi.fn();
    await expect(
      tokenizeCard(
        { tokenize },
        { ...baseDetails, billingContact: { ...baseDetails.billingContact, countryCode: "" } },
      ),
    ).rejects.toThrow(/countryCode/i);
    expect(tokenize).not.toHaveBeenCalled();
  });

  it("maps failed verification challenge cards", async () => {
    const tokenize = vi.fn().mockResolvedValue({
      status: "Error",
      errors: [{ message: "Verification failed" }],
    });
    await expect(tokenizeCard({ tokenize }, baseDetails)).rejects.toThrow(/Verification failed/);
  });
});

describe("assertVerificationDetails / tokenizeFailureMessage", () => {
  it("requires CHARGE customer-initiated online payments", () => {
    expect(() => assertVerificationDetails({ ...baseDetails, customerInitiated: false })).toThrow();
    expect(() => assertVerificationDetails({ ...baseDetails, sellerKeyedIn: true })).toThrow();
  });

  it("classifies cancel statuses", () => {
    expect(tokenizeFailureMessage({ status: "Cancel" })).toMatch(/cancell?ed/i);
  });
});
