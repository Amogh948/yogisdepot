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

interface SquareCardOptions {
  /** Prefills the card form postal/ZIP field (use Canadian A1A 1A1 for CA). */
  postalCode?: string;
  style?: Record<string, unknown>;
}

interface SquarePaymentRequestOptions {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
  requestBillingContact?: boolean;
  requestShippingContact?: boolean;
}

interface SquarePaymentRequest {
  update: (options: Partial<SquarePaymentRequestOptions>) => void;
}

interface SquareApplePay {
  tokenize: () => Promise<SquareTokenResult>;
  destroy?: () => Promise<void>;
}

interface SquareGooglePay {
  attach: (
    selector: string,
    options?: { buttonColor?: string; buttonType?: string; buttonSizeMode?: string },
  ) => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
}

interface SquarePayments {
  card: (options?: SquareCardOptions) => Promise<SquareCard>;
  paymentRequest: (options: SquarePaymentRequestOptions) => SquarePaymentRequest;
  applePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareApplePay>;
  googlePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareGooglePay>;
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
export function tokenizeFailureMessage(
  result: SquareTokenResult,
  kind: "card" | "wallet" = "card",
): string {
  const status = String(result.status || "").toUpperCase();
  const errMsg = result.errors?.[0]?.message || "";
  const cancelled =
    status === "CANCEL" ||
    status === "CANCELED" ||
    status === "CANCELLED" ||
    /cancell?ed/i.test(errMsg);
  if (cancelled) {
    return kind === "wallet" ? "Transaction was cancelled" : "Card verification was cancelled";
  }
  if (errMsg) return errMsg;
  return kind === "wallet"
    ? "Payment failed"
    : `Card tokenization failed (${result.status || "unknown"})`;
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

async function createSquarePayments(options: {
  applicationId: string;
  locationId: string;
  environment?: SquareEnvironment;
}): Promise<SquarePayments> {
  await loadSquareSdk(options.environment || "sandbox");
  if (!window.Square) {
    throw new Error("Square Web Payments SDK failed to initialize");
  }
  return window.Square.payments(options.applicationId, options.locationId);
}

export async function tokenizeWallet(
  wallet: Pick<SquareApplePay, "tokenize">,
  _label = "Wallet",
): Promise<SquareTokenizeResult> {
  const result = await wallet.tokenize();
  if (result.status !== "OK" || !result.token) {
    throw new Error(tokenizeFailureMessage(result, "wallet"));
  }
  return { sourceId: result.token };
}

function clearMount(selector?: string) {
  if (!selector || typeof document === "undefined") return;
  const node = document.querySelector(selector);
  if (node) node.innerHTML = "";
}

export async function attachSquareCard(options: {
  applicationId: string;
  locationId: string;
  environment?: SquareEnvironment;
  containerSelector: string;
  /** Prefill Square postal/ZIP from checkout address (supports Canadian alphanumeric). */
  postalCode?: string;
}): Promise<{
  tokenize: (details: SquareVerificationDetails) => Promise<SquareTokenizeResult>;
  destroy: () => Promise<void>;
}> {
  const checkout = await attachSquareCheckoutMethods({
    ...options,
    amount: "0.00",
    currencyCode: "CAD",
    googlePayContainerSelector: undefined,
    wallets: false,
  });
  return {
    tokenize: checkout.tokenizeCard,
    destroy: checkout.destroy,
  };
}

export type SquareDigitalWallets = {
  applePayAvailable: boolean;
  googlePayAvailable: boolean;
  /** Must be called synchronously from the Apple Pay button click handler. */
  tokenizeApplePay: () => Promise<SquareTokenizeResult>;
  tokenizeGooglePay: () => Promise<SquareTokenizeResult>;
  destroy: () => Promise<void>;
};

export type SquareCheckoutMethods = {
  cardReady: boolean;
  applePayAvailable: boolean;
  googlePayAvailable: boolean;
  tokenizeCard: (details: SquareVerificationDetails) => Promise<SquareTokenizeResult>;
  tokenizeApplePay: () => Promise<SquareTokenizeResult>;
  tokenizeGooglePay: () => Promise<SquareTokenizeResult>;
  destroy: () => Promise<void>;
};

/** True only when the browser/page can realistically host Apple Pay (Safari + HTTPS). */
export function canAttemptApplePay(
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  protocol = typeof window !== "undefined" ? window.location.protocol : "",
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  // Square/Apple require a public HTTPS domain — localhost and HTTP never show Apple Pay.
  if (protocol !== "https:") return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  const safari = /safari/i.test(userAgent) && !/chrome|crios|chromium|android|firefox|edg/i.test(userAgent);
  return safari;
}

/** Warm the Square script (and optionally Payments object) before the payment step. */
export async function prefetchSquare(options: {
  applicationId?: string;
  locationId?: string;
  environment?: SquareEnvironment;
}): Promise<void> {
  await loadSquareSdk(options.environment || "sandbox");
  if (options.applicationId && options.locationId && window.Square) {
    await window.Square.payments(options.applicationId, options.locationId).catch(() => undefined);
  }
}

/**
 * Initialize card + digital wallets with one Square Payments instance.
 * Wallet failures are non-fatal; card remains available.
 *
 * Apple Pay requires Safari on HTTPS with the domain registered in Square Dashboard
 * and `/.well-known/apple-developer-merchantid-domain-association` hosted.
 * It will not appear on localhost or non-Safari browsers.
 */
export async function attachSquareCheckoutMethods(options: {
  applicationId: string;
  locationId: string;
  environment?: SquareEnvironment;
  containerSelector?: string;
  postalCode?: string;
  amount: string;
  currencyCode: string;
  countryCode?: string;
  label?: string;
  googlePayContainerSelector?: string;
  wallets?: boolean;
}): Promise<SquareCheckoutMethods> {
  const payments = await createSquarePayments(options);
  const enableWallets = options.wallets !== false;

  const cardOptions: SquareCardOptions = {};
  const postal = String(options.postalCode || "").trim();
  if (postal) cardOptions.postalCode = postal;

  const cardPromise = (async () => {
    if (!options.containerSelector) return null;
    const card = await payments.card(Object.keys(cardOptions).length ? cardOptions : undefined);
    await card.attach(options.containerSelector);
    return card;
  })();

  const walletsPromise = (async () => {
    if (!enableWallets) return { applePay: null as SquareApplePay | null, googlePay: null as SquareGooglePay | null };
    const paymentRequest = payments.paymentRequest({
      countryCode: options.countryCode || "CA",
      currencyCode: options.currencyCode,
      total: {
        amount: options.amount,
        label: options.label || "Yogis Depot",
      },
    });

    const [appleResult, googleResult] = await Promise.allSettled([
      payments.applePay(paymentRequest),
      (async () => {
        if (!options.googlePayContainerSelector) return null;
        // Avoid duplicate Google Pay buttons if React Strict Mode / effect re-runs attach.
        clearMount(options.googlePayContainerSelector);
        const googlePay = await payments.googlePay(paymentRequest);
        await googlePay.attach(options.googlePayContainerSelector, {
          buttonColor: "black",
          buttonType: "long",
          buttonSizeMode: "fill",
        });
        return googlePay;
      })(),
    ]);

    return {
      applePay: appleResult.status === "fulfilled" ? appleResult.value : null,
      googlePay: googleResult.status === "fulfilled" ? googleResult.value : null,
    };
  })();

  const [card, wallets] = await Promise.all([cardPromise, walletsPromise]);
  const applePay = wallets.applePay;
  const googlePay = wallets.googlePay;
  const googlePaySelector = options.googlePayContainerSelector;

  return {
    cardReady: Boolean(card),
    applePayAvailable: Boolean(applePay),
    googlePayAvailable: Boolean(googlePay),
    tokenizeCard: async (details) => {
      if (!card) throw new Error("Card form is not ready");
      return tokenizeCard(card, details);
    },
    tokenizeApplePay: async () => {
      if (!applePay) throw new Error("Apple Pay is not available on this device");
      return tokenizeWallet(applePay, "Apple Pay");
    },
    tokenizeGooglePay: async () => {
      if (!googlePay) throw new Error("Google Pay is not available on this device");
      return tokenizeWallet(googlePay, "Google Pay");
    },
    destroy: async () => {
      await Promise.all([
        card?.destroy().catch(() => undefined),
        applePay?.destroy?.().catch(() => undefined),
        googlePay?.destroy().catch(() => undefined),
      ]);
      clearMount(googlePaySelector);
      if (options.containerSelector) clearMount(options.containerSelector);
    },
  };
}

/**
 * Initialize Apple Pay + Google Pay when the device/browser supports them.
 * Prefer attachSquareCheckoutMethods for checkout (shared Payments instance).
 */
export async function attachSquareDigitalWallets(options: {
  applicationId: string;
  locationId: string;
  environment?: SquareEnvironment;
  amount: string;
  currencyCode: string;
  countryCode?: string;
  label?: string;
  googlePayContainerSelector: string;
}): Promise<SquareDigitalWallets> {
  const checkout = await attachSquareCheckoutMethods({
    ...options,
    googlePayContainerSelector: options.googlePayContainerSelector,
    wallets: true,
  });
  return {
    applePayAvailable: checkout.applePayAvailable,
    googlePayAvailable: checkout.googlePayAvailable,
    tokenizeApplePay: checkout.tokenizeApplePay,
    tokenizeGooglePay: checkout.tokenizeGooglePay,
    destroy: checkout.destroy,
  };
}
