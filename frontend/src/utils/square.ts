const SANDBOX_SDK = "https://sandbox.web.squarecdn.com/v1/square.js";
const PRODUCTION_SDK = "https://web.squarecdn.com/v1/square.js";

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>;
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

export async function attachSquareCard(options: {
  applicationId: string;
  locationId: string;
  environment?: SquareEnvironment;
  containerSelector: string;
}): Promise<{ tokenize: () => Promise<string>; destroy: () => Promise<void> }> {
  await loadSquareSdk(options.environment || "sandbox");
  if (!window.Square) {
    throw new Error("Square Web Payments SDK failed to initialize");
  }
  const payments = await window.Square.payments(options.applicationId, options.locationId);
  const card = await payments.card();
  await card.attach(options.containerSelector);
  return {
    tokenize: async () => {
      const result = await card.tokenize();
      if (result.status !== "OK" || !result.token) {
        const message = result.errors?.[0]?.message || "Card tokenization failed";
        throw new Error(message);
      }
      return result.token;
    },
    destroy: async () => {
      await card.destroy().catch(() => undefined);
    },
  };
}
