import { expect, type Page, test } from "@playwright/test";

const CUSTOMER_EMAIL = "customer@yogisdepot.local";
const CUSTOMER_PASSWORD = "Password@123";

/** Square sandbox nonce that CreatePayment accepts without a real card token. */
const SQUARE_SANDBOX_CARD_NONCE_OK = "cnon:card-nonce-ok";

async function loginAndOpenCheckout(page: Page): Promise<void> {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  (page as Page & { __e2eErrors?: { consoleErrors: string[]; failedRequests: string[] } }).__e2eErrors = {
    consoleErrors,
    failedRequests,
  };

  await page.goto("/login");
  await page.getByLabel("Email").fill(CUSTOMER_EMAIL);
  await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/($|\?)/, { timeout: 20_000 });

  const cleared = await page.request.delete("/api/v1/cart");
  expect(cleared.ok(), `Cart clear failed: ${cleared.status()}`).toBeTruthy();

  const listing = await page.request.get("/api/v1/products?limit=20");
  expect(listing.ok()).toBeTruthy();
  const body = (await listing.json()) as {
    data: Array<{
      id: string;
      stock: number;
      skuId?: string;
      variants?: Array<{ skuId?: string }>;
      offers?: Array<{ skuId?: string; available?: boolean; availableQuantity?: number }>;
    }>;
  };
  const product = body.data.find((item) => {
    const offer = item.offers?.[0];
    if (offer) return offer.available !== false && (offer.availableQuantity ?? item.stock) > 0;
    return item.stock > 0;
  });
  expect(product, "No in-stock product available for checkout").toBeTruthy();
  const skuId = product!.offers?.[0]?.skuId || product!.skuId || product!.variants?.[0]?.skuId;
  const cartAdd = await page.request.post("/api/v1/cart", {
    data: skuId ? { skuId, quantity: 1 } : { productId: product!.id, quantity: 1 },
  });
  expect(
    cartAdd.ok(),
    `Cart add failed: ${cartAdd.status()} ${await cartAdd.text().catch(() => "")}`,
  ).toBeTruthy();

  await page.goto("/cart");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  const firstAddress = page.locator('input[name="address"]').first();
  await expect(firstAddress).toBeVisible({ timeout: 15_000 });
  await firstAddress.check();

  const continueDelivery = page.getByRole("button", { name: "Continue to delivery →" });
  await expect(continueDelivery).toBeEnabled({ timeout: 30_000 });
  await continueDelivery.click();

  await expect(page.getByRole("heading", { name: "Delivery" })).toBeVisible();
  await page.getByRole("button", { name: /Continue to payment/i }).click();
  await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
}

function e2eErrors(page: Page) {
  return (page as Page & { __e2eErrors?: { consoleErrors: string[]; failedRequests: string[] } }).__e2eErrors;
}

test.describe("Square checkout", () => {
  test("shows Pay by card when Square is enabled", async ({ page }) => {
    const config = await page.request.get("/api/v1/payments/config");
    const body = (await config.json()) as { data?: { squareEnabled?: boolean } };
    test.skip(!body.data?.squareEnabled, "Square sandbox credentials are not configured");

    await loginAndOpenCheckout(page);
    await expect(page.getByText("Pay by card")).toBeVisible();
    await expect(page.getByText(/Secure card payment via Square/i)).toBeVisible();
  });

  test("creates a Square payment intent and mounts card form", async ({ page }) => {
    const config = await page.request.get("/api/v1/payments/config");
    const body = (await config.json()) as { data?: { squareEnabled?: boolean } };
    test.skip(!body.data?.squareEnabled, "Square sandbox credentials are not configured");

    await loginAndOpenCheckout(page);
    await page.getByText("Pay by card").click();

    const createPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/orders") &&
        response.request().method() === "POST" &&
        !response.url().includes("pay"),
    );
    await page.getByRole("button", { name: /Place order/i }).click();
    const createResponse = await createPromise;
    expect(createResponse.ok(), `Create order failed: ${createResponse.status()}`).toBeTruthy();
    const created = (await createResponse.json()) as {
      data: {
        payment: {
          provider: string;
          clientPayload?: { applicationId?: string; locationId?: string; amountCents?: number };
        };
      };
    };
    expect(created.data.payment.provider).toBe("square");
    expect(created.data.payment.clientPayload?.applicationId).toBeTruthy();
    expect(created.data.payment.clientPayload?.locationId).toBeTruthy();
    expect(Number(created.data.payment.clientPayload?.amountCents)).toBeGreaterThan(0);
    await expect(page.locator("#square-card-container")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Pay now/i })).toBeVisible();
  });

  test("completes Square sandbox payment via verify + test nonce", async ({ page }) => {
    const config = await page.request.get("/api/v1/payments/config");
    const body = (await config.json()) as { data?: { squareEnabled?: boolean } };
    test.skip(!body.data?.squareEnabled, "Square sandbox credentials are not configured");

    await loginAndOpenCheckout(page);
    await page.getByText("Pay by card").click();

    const createPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/orders") &&
        response.request().method() === "POST" &&
        !response.url().includes("pay"),
    );
    await page.getByRole("button", { name: /Place order/i }).click();
    const createResponse = await createPromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as {
      data: { order: { id?: string; _id?: string } };
    };
    const orderId = created.data.order.id || created.data.order._id;
    expect(orderId).toBeTruthy();

    await expect(page.locator("#square-card-container")).toBeVisible({ timeout: 20_000 });

    const verify = await page.request.post(`/api/v1/orders/${orderId}/pay/verify`, {
      data: { sourceId: SQUARE_SANDBOX_CARD_NONCE_OK },
    });
    if (!verify.ok()) {
      const errors = e2eErrors(page);
      throw new Error(
        `Verify failed: ${verify.status()} ${await verify.text()}\n` +
          `Console errors: ${JSON.stringify(errors?.consoleErrors || [])}\n` +
          `Failed requests: ${JSON.stringify(errors?.failedRequests || [])}`,
      );
    }
    const verified = (await verify.json()) as {
      data: { paymentStatus?: string; orderStatus?: string; transactionId?: string };
    };
    expect(verified.data.paymentStatus).toBe("paid");
    expect(verified.data.orderStatus).toBe("confirmed");
    expect(verified.data.transactionId).toBeTruthy();

    await page.goto(`/order-success?orderId=${orderId}`);
    await expect(page).toHaveURL(/\/order-success/);
    await expect(page.getByText(/Payment successful/i)).toBeVisible();
  });
});
