import { OrderStatus } from "../../config/constants";

export type EmailLineItem = {
  name: string;
  variant?: string;
  quantity: number;
  totalCents: number;
};

export type EmailAddress = {
  fullName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
};

export type EmailBillInput = {
  subtotalCents: number;
  productDiscountCents?: number;
  couponDiscountCents?: number;
  couponCode?: string;
  scratchDiscountCents?: number;
  scratchRewardCode?: string;
  platformFeeCents: number;
  handlingFeeCents?: number;
  deliveryFeeCents: number;
  deliverySpeed?: string;
  taxCents: number;
  taxJurisdiction?: string;
  taxComponents?: Array<{ type: string; taxAmountCents: number }>;
  totalCents: number;
};

export type BillRow = {
  label: string;
  cents: number;
  tone?: "discount" | "total" | "muted";
};

export type OrderConfirmationContent = {
  orderNumber: string;
  customerName?: string;
  items: EmailLineItem[];
  bill: EmailBillInput;
  address: EmailAddress;
  estimatedDelivery: string;
  paymentMethod: string;
  cardLast4?: string;
  cardBrand?: string;
  orderUrl: string;
};

export type OrderStatusContent = {
  orderNumber: string;
  status: OrderStatus;
  customerName?: string;
  orderUrl: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

const STATUS_COPY: Record<string, { label: string; detail: string }> = {
  pending: {
    label: "Updated",
    detail: "We added tracking details to your order.",
  },
  confirmed: {
    label: "Confirmed",
    detail: "We've confirmed your order and will start preparing it.",
  },
  processing: {
    label: "Processing",
    detail: "We're preparing your order.",
  },
  packed: {
    label: "Packed",
    detail: "Your order is packed and ready to leave our store.",
  },
  shipped: {
    label: "Shipped",
    detail: "Your order has shipped.",
  },
  out_for_delivery: {
    label: "Out for delivery",
    detail: "Your order is out for delivery.",
  },
  delivered: {
    label: "Delivered",
    detail: "Your order was delivered.",
  },
  cancelled: {
    label: "Cancelled",
    detail: "Your order was cancelled. If a payment was captured, any refund will return to your card.",
  },
  returned: {
    label: "Returned",
    detail: "Your return has been recorded.",
  },
  refunded: {
    label: "Refunded",
    detail: "Your refund has been processed.",
  },
};

export function statusCopy(status: string): { label: string; detail: string } {
  return (
    STATUS_COPY[status] || {
      label: status.replace(/_/g, " "),
      detail: `Your order is now ${status.replace(/_/g, " ")}.`,
    }
  );
}

export function formatCadCents(cents: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    (Number.isFinite(cents) ? cents : 0) / 100,
  );
}

export function paymentMethodLabel(input: {
  paymentMethod: string;
  cardLast4?: string;
  cardBrand?: string;
}): string {
  const last4 = input.cardLast4 && /^\d{4}$/.test(input.cardLast4) ? input.cardLast4 : "";
  if (input.paymentMethod === "cod") return "Cash on delivery";
  const brand = cardBrandLabel(input.cardBrand);
  if (last4) return `${brand} ending in ${last4}`;
  if (input.paymentMethod === "mock_online") return "Card (test checkout)";
  return "Card";
}

function cardBrandLabel(brand?: string): string {
  const key = String(brand || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (key === "visa") return "Visa";
  if (key === "mastercard" || key === "master_card") return "Mastercard";
  if (key === "american_express" || key === "amex") return "American Express";
  if (key === "discover") return "Discover";
  if (key === "interac") return "Interac";
  return "Card";
}

export function confirmationBillRows(bill: EmailBillInput): BillRow[] {
  const coupon = Math.max(0, bill.couponDiscountCents || 0);
  const scratch = Math.max(0, bill.scratchDiscountCents || 0);
  const handling = Math.max(0, bill.handlingFeeCents || 0);
  const merchandise = bill.subtotalCents - coupon - scratch;
  const accounted =
    merchandise + bill.platformFeeCents + handling + bill.deliveryFeeCents + bill.taxCents;
  const smallCart = bill.totalCents - accounted;
  const deliveryLabel =
    bill.deliverySpeed === "superfast" ? "Delivery fee (superfast)" : "Delivery fee";
  const rows: BillRow[] = [{ label: "Product subtotal", cents: bill.subtotalCents }];
  if (coupon > 0) {
    rows.push({
      label: bill.couponCode ? `Coupon (${bill.couponCode})` : "Coupon",
      cents: -coupon,
      tone: "discount",
    });
  }
  if (scratch > 0) {
    rows.push({
      label: bill.scratchRewardCode ? `Scratch reward (${bill.scratchRewardCode})` : "Scratch reward",
      cents: -scratch,
      tone: "discount",
    });
  }
  rows.push({ label: "Platform fee", cents: bill.platformFeeCents });
  if (handling > 0) rows.push({ label: "Handling fee", cents: handling });
  rows.push({ label: deliveryLabel, cents: bill.deliveryFeeCents });
  if (smallCart > 0) rows.push({ label: "Small cart fee", cents: smallCart });
  const taxLabel = bill.taxJurisdiction ? `Tax (${bill.taxJurisdiction})` : "Tax";
  rows.push({ label: taxLabel, cents: bill.taxCents });
  for (const component of bill.taxComponents || []) {
    if (!component.type || component.taxAmountCents <= 0) continue;
    rows.push({
      label: `Includes ${component.type.toUpperCase()}`,
      cents: component.taxAmountCents,
      tone: "muted",
    });
  }
  rows.push({ label: "Total paid", cents: bill.totalCents, tone: "total" });
  return rows;
}

export function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyText(cents: number, tone?: BillRow["tone"]): string {
  if (tone === "discount") return `−${formatCadCents(Math.abs(cents))}`;
  return formatCadCents(cents);
}

function greeting(name?: string): string {
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : "Hi,";
}

function addressLines(address: EmailAddress): string[] {
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  return [
    address.fullName,
    address.addressLine1,
    address.addressLine2 || "",
    address.landmark ? `Landmark: ${address.landmark}` : "",
    cityLine,
    address.country,
    address.phone || "",
  ].filter((line) => line.trim().length > 0);
}

function layout(input: { preheader: string; title: string; innerHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F1;color:#171717;font-family:Georgia, 'Times New Roman', serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${esc(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F1;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E7DED2;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#183C2B;padding:22px 28px;">
              <p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#F3E7D3;">Yogi's Depot</p>
              <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:normal;">${esc(input.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:Arial, Helvetica, sans-serif;font-size:15px;line-height:1.5;color:#171717;">
              ${input.innerHtml}
            </td>
          </tr>
        </table>
        <p style="font-family:Arial, Helvetica, sans-serif;font-size:12px;color:#6F6A63;max-width:600px;">Yogi's Depot · Calgary grocery delivery</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 0;"><a href="${esc(href)}" style="display:inline-block;background:#287A43;color:#ffffff;text-decoration:none;font-family:Arial, Helvetica, sans-serif;font-size:14px;font-weight:bold;padding:12px 18px;border-radius:999px;">${esc(label)}</a></p>`;
}

export function buildOrderConfirmationEmail(input: OrderConfirmationContent): {
  subject: string;
  html: string;
  text: string;
} {
  const payment = paymentMethodLabel(input);
  const rows = confirmationBillRows(input.bill);
  const hello = greeting(input.customerName);
  const subject = `Your Yogi's Depot order ${input.orderNumber}`;
  const itemRows = input.items
    .map((item) => {
      const variant = item.variant ? ` · ${esc(item.variant)}` : "";
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #E7DED2;">${esc(item.name)}${variant}<br /><span style="color:#6F6A63;">Qty ${esc(item.quantity)}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #E7DED2;text-align:right;white-space:nowrap;">${esc(formatCadCents(item.totalCents))}</td>
      </tr>`;
    })
    .join("");
  const billRows = rows
    .map((row) => {
      const color = row.tone === "discount" ? "#287A43" : "#171717";
      const weight = row.tone === "total" ? "bold" : "normal";
      const size = row.tone === "muted" ? "13px" : "15px";
      const pad = row.tone === "muted" ? "2px 0 2px 12px" : "6px 0";
      const border = row.tone === "total" ? "border-top:1px solid #E7DED2;" : "";
      return `<tr>
        <td style="padding:${pad};${border}color:${color};font-weight:${weight};font-size:${size};">${esc(row.label)}</td>
        <td style="padding:${pad};${border}color:${color};font-weight:${weight};font-size:${size};text-align:right;white-space:nowrap;">${esc(moneyText(row.cents, row.tone))}</td>
      </tr>`;
    })
    .join("");
  const addressHtml = addressLines(input.address)
    .map((line) => esc(line))
    .join("<br />");
  const html = layout({
    preheader: `Order ${input.orderNumber} is confirmed. Estimated delivery ${input.estimatedDelivery}.`,
    title: "Order confirmed",
    innerHtml: `
      <p style="margin:0 0 12px;">${esc(hello)}</p>
      <p style="margin:0 0 16px;">Thanks for your order. Payment was received and we're getting it ready.</p>
      <p style="margin:0 0 4px;"><strong>Order ${esc(input.orderNumber)}</strong></p>
      <p style="margin:0 0 4px;">Estimated delivery: ${esc(input.estimatedDelivery)}</p>
      <p style="margin:0 0 18px;">Payment: ${esc(payment)}</p>
      ${(input.bill.productDiscountCents || 0) > 0 ? `<p style="margin:0 0 12px;color:#287A43;">You saved ${esc(formatCadCents(input.bill.productDiscountCents || 0))} off MRP.</p>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">${billRows}</table>
      <h2 style="font-size:16px;margin:24px 0 8px;color:#183C2B;">Delivery address</h2>
      <p style="margin:0;">${addressHtml}</p>
      ${button(input.orderUrl, "View your order")}
    `,
  });
  const textItems = input.items
    .map((item) => {
      const variant = item.variant ? ` (${item.variant})` : "";
      return `- ${item.name}${variant} × ${item.quantity} — ${formatCadCents(item.totalCents)}`;
    })
    .join("\n");
  const textBill = rows.map((row) => `${row.label}: ${moneyText(row.cents, row.tone)}`).join("\n");
  const text = [
    hello,
    "",
    "Thanks for your order. Payment was received and we're getting it ready.",
    "",
    `Order ${input.orderNumber}`,
    `Estimated delivery: ${input.estimatedDelivery}`,
    `Payment: ${payment}`,
    (input.bill.productDiscountCents || 0) > 0
      ? `You saved ${formatCadCents(input.bill.productDiscountCents || 0)} off MRP.`
      : "",
    "",
    "Items",
    textItems,
    "",
    textBill,
    "",
    "Delivery address",
    addressLines(input.address).join("\n"),
    "",
    `View your order: ${input.orderUrl}`,
  ].join("\n");
  return { subject, html, text };
}

export function buildOrderStatusEmail(input: OrderStatusContent): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = statusCopy(input.status);
  const hello = greeting(input.customerName);
  const trackingUrl = safeHttpUrl(input.trackingUrl);
  const subject = `Your Yogi's Depot order ${input.orderNumber} is ${copy.label.toLowerCase()}`;
  const trackingHtml = [
    input.trackingNumber
      ? `<p style="margin:12px 0 0;">Tracking number: <strong>${esc(input.trackingNumber)}</strong></p>`
      : "",
    trackingUrl ? button(trackingUrl, "Track shipment") : "",
  ].join("");
  const html = layout({
    preheader: `Order ${input.orderNumber} is ${copy.label}.`,
    title: copy.label,
    innerHtml: `
      <p style="margin:0 0 12px;">${esc(hello)}</p>
      <p style="margin:0 0 12px;">${esc(copy.detail)}</p>
      <p style="margin:0;">Order <strong>${esc(input.orderNumber)}</strong></p>
      ${trackingHtml}
      ${button(input.orderUrl, "View your order")}
    `,
  });
  const text = [
    hello,
    "",
    copy.detail,
    "",
    `Order ${input.orderNumber}`,
    `Status: ${copy.label}`,
    input.trackingNumber ? `Tracking number: ${input.trackingNumber}` : undefined,
    trackingUrl ? `Track shipment: ${trackingUrl}` : undefined,
    "",
    `View your order: ${input.orderUrl}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
  return { subject, html, text };
}
