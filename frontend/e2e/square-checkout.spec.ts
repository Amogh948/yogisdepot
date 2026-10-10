import { expect, type Page, test } from "@playwright/test";

const CUSTOMER_EMAIL = "customer@yogisdepot.local";
const CUSTOMER_PASSWORD = "Password@123";

async function loginAndOpenCheckout(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(CUSTOMER_EMAIL);
  await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/($|\?)/, { timeout: 20_000 });

  await page.goto("/products");
  const addToCart = page.getByRole("button", { name: /to cart/i }).first();
  await expect(addToCart).toBeEnabled();
  await addToCart.click();
  await expect(page.getByText(/added to cart|could not update cart/i)).toBeVisible();

  const listing = await page.request.get("/api/v1/products?limit=20");
  const body = (await listing.json()) as { data: Array<{ id: string; stock: number }> };
  const product = body.data.find((item) => item.stock > 0);
  if (product) {
    await page.request.post("/api/v1/cart", { data: { productId: product.id, quantity: 1 } });
  }

  await page.goto("/cart");
  await expect(page.getByRole("button", { name: "Checkout" })).toBeVisible();
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByRole("button", { name: /Continue to delivery/i }).click();
  const firstAddress = page.locator('input[name="address"]').first();
  if (await firstAddress.count()) {
    await firstAddress.check();
  }
  await page.getByRole("button", { name: /Continue to delivery/i }).click();
  await page.getByRole("button", { name: /Continue to payment/i }).click();
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

  test("creates a Square payment intent from checkout place-order", async ({ page }) => {
    const config = await page.request.get("/api/v1/payments/config");
    const body = (await config.json()) as { data?: { squareEnabled?: boolean } };
    test.skip(!body.data?.squareEnabled, "Square sandbox credentials are not configured");

    await loginAndOpenCheckout(page);
    await page.getByText("Pay by card").click();

    const createPromise = page.waitForResponse(
      (response) => response.url().includes("/orders") && response.request().method() === "POST" && !response.url().includes("pay"),
    );
    await page.getByRole("button", { name: /Place order/i }).click();
    const createResponse = await createPromise;
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as {
      data: { payment: { provider: string; clientPayload?: { applicationId?: string; locationId?: string } } };
    };
    expect(created.data.payment.provider).toBe("square");
    expect(created.data.payment.clientPayload?.applicationId).toBeTruthy();
    expect(created.data.payment.clientPayload?.locationId).toBeTruthy();
    await expect(page.locator("#square-card-container")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Pay now/i })).toBeVisible();
  });
});
