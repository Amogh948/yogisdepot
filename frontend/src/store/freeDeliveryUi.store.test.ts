import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFreeDeliveryUnlockCelebrated,
  hasCelebratedFreeDeliveryUnlock,
  markFreeDeliveryUnlockCelebrated,
  useFreeDeliveryUiStore,
} from "./freeDeliveryUi.store";

describe("freeDeliveryUi.store", () => {
  beforeEach(() => {
    clearFreeDeliveryUnlockCelebrated();
    useFreeDeliveryUiStore.setState({ open: false });
  });

  it("tracks celebration once per unlock cycle in sessionStorage", () => {
    expect(hasCelebratedFreeDeliveryUnlock()).toBe(false);
    markFreeDeliveryUnlockCelebrated();
    expect(hasCelebratedFreeDeliveryUnlock()).toBe(true);
    clearFreeDeliveryUnlockCelebrated();
    expect(hasCelebratedFreeDeliveryUnlock()).toBe(false);
  });

  it("opens and dismisses the celebration dialog", () => {
    useFreeDeliveryUiStore.getState().show();
    expect(useFreeDeliveryUiStore.getState().open).toBe(true);
    useFreeDeliveryUiStore.getState().dismiss();
    expect(useFreeDeliveryUiStore.getState().open).toBe(false);
  });
});
