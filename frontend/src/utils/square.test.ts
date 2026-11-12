import { describe, expect, it, vi } from "vitest";
import {
  assertVerificationDetails,
  canAttemptApplePay,
  centsToSquareAmount,
  squareSdkUrl,
  tokenizeCard,
  tokenizeFailureMessage,
  tokenizeWallet,
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
    expect(tokenizeFailureMessage({ status: "Cancel" })).toBe("Card verification was cancelled");
    expect(tokenizeFailureMessage({ status: "Cancel" }, "wallet")).toBe("Transaction was cancelled");
  });
});

describe("tokenizeWallet", () => {
  it("returns a sourceId for Apple/Google Pay tokens", async () => {
    const tokenize = vi.fn().mockResolvedValue({ status: "OK", token: "cnon:wallet" });
    await expect(tokenizeWallet({ tokenize }, "Apple Pay")).resolves.toEqual({ sourceId: "cnon:wallet" });
  });

  it("maps cancelled wallet sheets to Transaction was cancelled", async () => {
    const tokenize = vi.fn().mockResolvedValue({ status: "Cancel" });
    await expect(tokenizeWallet({ tokenize }, "Google Pay")).rejects.toThrow("Transaction was cancelled");
  });
});

describe("canAttemptApplePay", () => {
  it("requires Safari on a public HTTPS host", () => {
    const safari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    const chrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(canAttemptApplePay("yogisdepot.com", "https:", safari)).toBe(true);
    expect(canAttemptApplePay("localhost", "http:", safari)).toBe(false);
    expect(canAttemptApplePay("yogisdepot.com", "https:", chrome)).toBe(false);
  });
});
