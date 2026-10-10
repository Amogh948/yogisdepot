const SANDBOX_SDK = "https://sandbox.web.squarecdn.com/v1/square.js";
const PRODUCTION_SDK = "https://web.squarecdn.com/v1/square.js";

/**
 * Buyer verification details for Card.tokenize().
 * Official flow: https://developer.squareup.com/docs/web-payments/take-card-payment
 * Do NOT also call payments.verifyBuyer() — Square embeds SCA in tokenize().
 */
export interface SquareVerificationDetails {
  amount: string;
  currencyCode: string;
  intent: "CHARGE" | "STORE" | "CHARGE_AND_STORE";
  customerInitiated: boolean;
  sellerKeyedIn: boolean;
  billingContact: {
    givenName?: string;
    familyName?: string;
    email?: string;
    phone?: string;
    addressLines?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
}

interface SquareTokenResult {
  status: string;
  token?: string;
  errors?: Array<{ message?: string; type?: string; code?: string }>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: (verificationDetails: SquareVerificationDetails) => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}

declare global {
  interface Window {
    Square?: {
      payments: (applicationId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

export type SquareEnvironment = "sandbox" | "production";

export type SquareTokenizeResult = {
  sourceId: string;
};

export function squareSdkUrl(environment: SquareEnvironment = "sandbox"): string {
  return environment === "production" ? PRODUCTION_SDK : SANDBOX_SDK;
}

export function loadSquareSdk(environment: SquareEnvironment = "sandbox"): Promise<void> {
  if (window.Square) {
    return Promise.resolve();
  }
  const src = squareSdkUrl(environment);
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Unable to load Square")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Square Web Payments SDK"));
    document.head.appendChild(script);
  });
}

/** Map storefront country labels to ISO 3166-1 alpha-2 for Square. */
export function toSquareCountryCode(country?: string): string {
  const value = (country || "").trim().toUpperCase();
  if (value === "CA" || value === "CAN" || value === "CANADA") return "CA";
  if (value.length === 2) return value;
  return "CA";
}

export function centsToSquareAmount(amountCents: number): string {
  return (Math.round(amountCents) / 100).toFixed(2);
}

export function assertVerificationDetails(details: SquareVerificationDetails): void {
  if (!details.amount || !/^\d+\.\d{2}$/.test(details.amount)) {
    throw new Error("Square verification amount must be a decimal string such as 44.47");
  }
  if (!details.currencyCode || details.currencyCode.length !== 3) {
    throw new Error("Square verification currencyCode is required");
  }
  if (details.intent !== "CHARGE" && details.intent !== "STORE" && details.intent !== "CHARGE_AND_STORE") {
    throw new Error("Square verification intent is invalid");
  }
  if (details.customerInitiated !== true) {
    throw new Error("Square CHARGE payments must be customerInitiated");
  }
  if (details.sellerKeyedIn !== false) {
    throw new Error("Online checkout must set sellerKeyedIn=false");
  }
  if (!details.billingContact?.countryCode) {
    throw new Error("Square billingContact.countryCode is required for buyer verification");
  }
}

/** Maps TokenResult.status into an Error with a stable message for checkout UX/tests. */
export function tokenizeFailureMessage(result: SquareTokenResult): string {
  const status = String(result.status || "").toUpperCase();
  if (status === "CANCEL" || status === "CANCELED" || status === "CANCELLED") {
    return "Card verification was cancelled";
  }
  return result.errors?.[0]?.message || `Card tokenization failed (${result.status || "unknown"})`;
}

/**
 * Pure tokenize helper used by attachSquareCard and unit tests.
 * Must receive verificationDetails so Sandbox SCA challenge cards can show a modal.
 */
export async function tokenizeCard(
  card: Pick<SquareCard, "tokenize">,
  details: SquareVerificationDetails,
): Promise<SquareTokenizeResult> {
  assertVerificationDetails(details);
  const result = await card.tokenize(details);
  if (result.status !== "OK" || !result.token) {
    throw new Error(tokenizeFailureMessage(result));
  }
  // Modern Web Payments SDK embeds buyer verification in the payment token.
  // Do not call payments.verifyBuyer() afterward — that duplicates analytics
  // and is deprecated: https://developer.squareup.com/docs/web-payments/take-card-payment
  return { sourceId: result.token };
}

export async function attachSquareCard(options: {
  applicationId: string;
  locationId: string;
  environment?: SquareEnvironment;
  containerSelector: string;
}): Promise<{
  tokenize: (details: SquareVerificationDetails) => Promise<SquareTokenizeResult>;
  destroy: () => Promise<void>;
}> {
  await loadSquareSdk(options.environment || "sandbox");
  if (!window.Square) {
    throw new Error("Square Web Payments SDK failed to initialize");
  }
  const payments = await window.Square.payments(options.applicationId, options.locationId);
  const card = await payments.card();
  await card.attach(options.containerSelector);

  return {
    tokenize: (details) => tokenizeCard(card, details),
    destroy: async () => {
      await card.destroy().catch(() => undefined);
    },
  };
}
