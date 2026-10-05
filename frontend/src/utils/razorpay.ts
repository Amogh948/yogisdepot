interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: { description?: string; reason?: string; code?: string };
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  onFailure?: (response: RazorpayFailureResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const PUBLIC_EMAIL = /^[^\s@]+@[^\s@]+\.(?!local$)[a-z]{2,}$/i;

export function toRazorpayContact(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

export function toRazorpayEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const trimmed = email.trim();
  if (!PUBLIC_EMAIL.test(trimmed)) return undefined;
  return trimmed;
}

export function toRazorpayName(name?: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name.replace(/[^a-zA-Z0-9 .'-]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay"));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  await loadRazorpayScript();
  const prefill: { name?: string; email?: string; contact?: string } = {};
  const name = toRazorpayName(options.prefill?.name);
  const email = toRazorpayEmail(options.prefill?.email);
  const contact = toRazorpayContact(options.prefill?.contact);
  if (name) prefill.name = name;
  if (email) prefill.email = email;
  if (contact) prefill.contact = contact;

  const checkout = new window.Razorpay({
    key: options.key,
    amount: Math.round(Number(options.amount)),
    currency: options.currency || "CAD",
    name: toRazorpayName(options.name) || "Yogis Depot",
    description: options.description?.replace(/[^a-zA-Z0-9 .'-]/g, " ").trim() || "Order payment",
    order_id: options.order_id,
    prefill,
    remember_customer: false,
    retry: { enabled: false },
    theme: options.theme,
    handler: options.handler,
    modal: {
      confirm_close: true,
      escape: true,
      ondismiss: options.modal?.ondismiss,
    },
  });

  checkout.on("payment.failed", (response) => {
    options.onFailure?.(response);
  });
  checkout.open();
}
