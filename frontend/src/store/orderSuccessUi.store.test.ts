import { beforeEach, describe, expect, it } from "vitest";
import {
  clearOrderSuccessCelebrated,
  hasCelebratedOrderSuccess,
  markOrderSuccessCelebrated,
  shouldCelebrateOrderSuccess,
} from "./orderSuccessUi.store";

describe("orderSuccessUi.store", () => {
  beforeEach(() => {
    clearOrderSuccessCelebrated("ord-1");
    clearOrderSuccessCelebrated("ord-2");
  });

  it("tracks celebration once per order in sessionStorage", () => {
    expect(hasCelebratedOrderSuccess("ord-1")).toBe(false);
    markOrderSuccessCelebrated("ord-1");
    expect(hasCelebratedOrderSuccess("ord-1")).toBe(true);
    expect(hasCelebratedOrderSuccess("ord-2")).toBe(false);
  });

  it("celebrates only when navigate state matches a confirmed order", () => {
    expect(
      shouldCelebrateOrderSuccess({
        orderId: "ord-1",
        navigateCelebrateOrderId: "ord-1",
        isConfirmedSuccess: true,
      }),
    ).toBe(true);

    expect(
      shouldCelebrateOrderSuccess({
        orderId: "ord-1",
        navigateCelebrateOrderId: "ord-1",
        isConfirmedSuccess: false,
      }),
    ).toBe(false);

    expect(
      shouldCelebrateOrderSuccess({
        orderId: "ord-1",
        navigateCelebrateOrderId: "ord-other",
        isConfirmedSuccess: true,
      }),
    ).toBe(false);
  });

  it("does not celebrate again after mark", () => {
    markOrderSuccessCelebrated("ord-1");
    expect(
      shouldCelebrateOrderSuccess({
        orderId: "ord-1",
        navigateCelebrateOrderId: "ord-1",
        isConfirmedSuccess: true,
      }),
    ).toBe(false);
  });
});
