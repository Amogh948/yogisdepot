import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import { applyOptimisticAdd, applyOptimisticCart, emptyCart } from "./cartOptimistic";

const product = {
  _id: "p1",
  name: "Test Chai",
  slug: "test-chai",
  price: 10,
  stock: 20,
} as Product;

describe("cartOptimistic", () => {
  it("adds a new line and updates totals", () => {
    const next = applyOptimisticAdd(emptyCart(), product, 2);
    expect(next.items).toHaveLength(1);
    expect(next.items[0].quantity).toBe(2);
    expect(next.itemCount).toBe(2);
    expect(next.subtotal).toBe(20);
  });

  it("updates and removes quantities", () => {
    const withItem = applyOptimisticCart(emptyCart(), product, 3);
    const updated = applyOptimisticCart(withItem, product, 5);
    expect(updated.items[0].quantity).toBe(5);
    expect(updated.subtotal).toBe(50);
    const removed = applyOptimisticCart(updated, product, 0);
    expect(removed.items).toHaveLength(0);
    expect(removed.itemCount).toBe(0);
  });
});
