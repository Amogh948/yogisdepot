import { describe, expect, it } from "vitest";
import { enqueueEmail, sendWithRetry } from "./mailer.service";
import { shouldEmailOrderStatus } from "./orderEmail.service";

describe("sendWithRetry", () => {
  it("succeeds after a transient failure", async () => {
    let calls = 0;
    await sendWithRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error("smtp timeout");
      },
      { attempts: 3, delayMs: 0 },
    );
    expect(calls).toBe(2);
  });

  it("throws after the last attempt", async () => {
    await expect(
      sendWithRetry(
        async () => {
          throw new Error("mailbox unavailable");
        },
        { attempts: 2, delayMs: 0 },
      ),
    ).rejects.toThrow("mailbox unavailable");
  });
});

describe("enqueueEmail", () => {
  it("does not reject the caller when sending fails", async () => {
    let ran = false;
    enqueueEmail(async () => {
      ran = true;
      throw new Error("smtp down");
    });
    expect(ran).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(ran).toBe(true);
  });
});

describe("status email policy", () => {
  it("emails fulfillment changes and skips the initial placed state", () => {
    expect(shouldEmailOrderStatus("pending")).toBe(false);
    expect(shouldEmailOrderStatus("confirmed")).toBe(true);
    expect(shouldEmailOrderStatus("shipped")).toBe(true);
    expect(shouldEmailOrderStatus("out_for_delivery")).toBe(true);
    expect(shouldEmailOrderStatus("delivered")).toBe(true);
    expect(shouldEmailOrderStatus("cancelled")).toBe(true);
  });
});
