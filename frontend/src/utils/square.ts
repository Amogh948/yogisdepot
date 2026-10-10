const SANDBOX_SDK = "https://sandbox.web.squarecdn.com/v1/square.js";
const PRODUCTION_SDK = "https://web.squarecdn.com/v1/square.js";

/** Buyer verification details for Card.tokenize() (Square SCA / 3DS). */
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
  /** Present on older SDK flows; modern tokenize embeds verification in the payment token. */
  verificationToken?: string;
  errors?: Array<{ message?: string; type?: string; code?: string }>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: (verificationDetails?: SquareVerificationDetails) => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
}

interface SquareVerifyBuyerResult {
  token?: string;
  userChallenged?: boolean;
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
  /** @deprecated Square is retiring this in favor of Card.tokenize(verificationDetails). Kept as fallback. */
  verifyBuyer?: (sourceId: string, details: SquareVerificationDetails) => Promise<SquareVerifyBuyerResult>;
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
  /** Optional legacy SCA token; send when present so CreatePayment can use it. */
  verificationToken?: string;
};

export function loadSquareSdk(environment: SquareEnvironment = "sandbox"): Promise<void> {
  if (window.Square) {
    return Promise.resolve();
  }
  const src = environment === "production" ? PRODUCTION_SDK : SANDBOX_SDK;
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
    tokenize: async (details: SquareVerificationDetails) => {
      // Current Square guidance: pass verificationDetails into tokenize so SCA/3DS
      // runs when required. Do not skip challenges or assume an OTP always appears.
      const result = await card.tokenize(details);
      if (result.status !== "OK" || !result.token) {
        const message = result.errors?.[0]?.message || `Card tokenization failed (${result.status})`;
        throw new Error(message);
      }

      let verificationToken = result.verificationToken;
      // Fallback for SDK builds that still expose verifyBuyer separately.
      if (!verificationToken && typeof payments.verifyBuyer === "function") {
        try {
          const verified = await payments.verifyBuyer(result.token, details);
          verificationToken = verified?.token || undefined;
        } catch {
          // Square may not challenge every payment; CreatePayment proceeds with sourceId alone.
        }
      }

      return {
        sourceId: result.token,
        ...(verificationToken ? { verificationToken } : {}),
      };
    },
    destroy: async () => {
      await card.destroy().catch(() => undefined);
    },
  };
}
