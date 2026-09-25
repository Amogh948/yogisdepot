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

  await page.getByRole("button", { name: "Continue" }).click();
  const firstAddress = page.locator('input[name="address"]').first();
  if (await firstAddress.count()) {
    await firstAddress.check();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Pay online (Razorpay)")).toBeVisible();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: "Pay with Razorpay" }).click();
}

async function razorpayFrame(page: Page) {
  await expect(page.locator("iframe.razorpay-checkout-frame, iframe[src*='razorpay']").first()).toBeVisible({
    timeout: 30_000,
  });
  return page.frameLocator("iframe.razorpay-checkout-frame, iframe[src*='razorpay']").first();
}

test.describe("Razorpay checkout", () => {
  test("opens the Razorpay payment gateway from checkout", async ({ page }) => {
    await loginAndOpenCheckout(page);
    const checkout = await razorpayFrame(page);
    await expect(checkout.getByText(/payment options/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Test Mode")).toBeVisible();
  });

  test("completes a Razorpay test payment", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAndOpenCheckout(page);
    const checkout = await razorpayFrame(page);

    const netbanking = checkout.getByRole("radio", { name: /netbanking/i });
    await expect(netbanking).toBeVisible({ timeout: 15_000 });
    await netbanking.click({ force: true });
    await expect(checkout.getByText(/popular banks|all banks|bank/i).first()).toBeVisible({ timeout: 10_000 });

    const popupPromise = page.waitForEvent("popup", { timeout: 20_000 }).catch(() => null);
    const bank = checkout.getByText(/hdfc|icici|sbi|axis|yes bank|kotak/i).first();
    if (await bank.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bank.click({ force: true });
    } else {
      const otherBank = checkout.getByRole("radio").nth(3);
      await otherBank.click({ force: true });
    }

    const popup = (await popupPromise) ?? page.context().pages().find((current) => current !== page);
    if (popup) {
      await popup.getByRole("button", { name: /success/i }).click({ timeout: 20_000 });
    } else {
      const deadline = Date.now() + 40_000;
      while (Date.now() < deadline) {
        if (/\/orders\/[a-f0-9]{24}/i.test(page.url())) break;
        for (const current of page.context().pages()) {
          const success = current.getByRole("button", { name: /success/i });
          if (await success.count()) {
            await success.first().click({ force: true, timeout: 2_000 }).catch(() => undefined);
          }
        }
        await page.waitForTimeout(400);
      }
    }

    await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}/, { timeout: 30_000 });
    await expect(page.getByText(/confirmed · paid/i)).toBeVisible();
  });
});
