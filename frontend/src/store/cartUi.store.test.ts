import { beforeEach, describe, expect, it } from "vitest";
import { rememberCartPointer, useCartUiStore } from "./cartUi.store";

describe("cartUi.store", () => {
  beforeEach(() => {
    useCartUiStore.setState({ bump: 0, bursts: [], confirmation: null });
  });

  it("celebrateAdd bumps cart, spawns a burst, and sets confirmation", () => {
    rememberCartPointer(120, 240);
    useCartUiStore.getState().celebrateAdd();

    const state = useCartUiStore.getState();
    expect(state.bump).toBe(1);
    expect(state.bursts).toHaveLength(1);
    expect(state.bursts[0].x).toBe(120);
    expect(state.bursts[0].y).toBe(240);
    expect(state.confirmation?.message).toBe("Added to cart!");
  });

  it("caps concurrent bursts under rapid celebration", () => {
    useCartUiStore.getState().celebrateAdd({ x: 1, y: 1 });
    useCartUiStore.getState().celebrateAdd({ x: 2, y: 2 });
    useCartUiStore.getState().celebrateAdd({ x: 3, y: 3 });

    const { bursts, bump } = useCartUiStore.getState();
    expect(bursts).toHaveLength(2);
    expect(bursts.map((b) => b.x)).toEqual([2, 3]);
    expect(bump).toBe(3);
  });

  it("replaces confirmation instead of stacking messages", () => {
    useCartUiStore.getState().celebrateAdd({ x: 10, y: 10 });
    const firstId = useCartUiStore.getState().confirmation?.id;
    useCartUiStore.getState().celebrateAdd({ x: 20, y: 20 });
    const second = useCartUiStore.getState().confirmation;
    expect(second?.id).not.toBe(firstId);
    expect(second?.message).toBe("Added to cart!");
  });
});
