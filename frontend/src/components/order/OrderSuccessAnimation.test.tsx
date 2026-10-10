import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderSuccessAnimation } from "./OrderSuccessAnimation";

function renderAnim(playCelebration: boolean) {
  return render(
    <MemoryRouter>
      <OrderSuccessAnimation
        orderNumber="YD-1001"
        orderId="ord-abc"
        deliveryNote="Preparing delivery to Calgary"
        playCelebration={playCelebration}
      />
    </MemoryRouter>,
  );
}

describe("OrderSuccessAnimation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion") ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows order number and actions from props", () => {
    renderAnim(true);
    expect(screen.getByText("YD-1001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /woohoo! your order is confirmed/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view order/i })).toHaveAttribute("href", "/orders/ord-abc");
    expect(screen.getByRole("link", { name: /continue shopping/i })).toHaveAttribute("href", "/products");
  });

  it("marks celebration mode when playCelebration is true", () => {
    renderAnim(true);
    expect(screen.getByTestId("order-success-celebration")).toHaveAttribute("data-celebrating", "true");
  });

  it("still shows confirmation without celebrating when playCelebration is false", () => {
    renderAnim(false);
    const root = screen.getByTestId("order-success-celebration");
    expect(root).toHaveAttribute("data-celebrating", "false");
    expect(screen.getByText("YD-1001")).toBeInTheDocument();
  });

  it("respects prefers-reduced-motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    renderAnim(true);
    expect(screen.getByTestId("order-success-celebration")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByRole("heading", { name: /woohoo! your order is confirmed/i })).toBeInTheDocument();
  });
});
