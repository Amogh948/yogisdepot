import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { discountPercentFromPrices, Price } from "./Feedback";

vi.mock("../../hooks/useSettings", () => ({
  useCurrencyCode: () => "CAD",
}));

describe("Price / PriceDisplay", () => {
  it("hides strike-through when there is no real discount", () => {
    render(<Price price={12.99} compareAt={12.99} showBadge />);
    expect(screen.getByText(/\$12\.99/)).toBeInTheDocument();
    expect(screen.queryByText("% OFF")).not.toBeInTheDocument();
  });

  it("shows strike-through and badge when original is higher", () => {
    render(<Price price={10} compareAt={20} showBadge />);
    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
    expect(screen.getByText("50% OFF")).toBeInTheDocument();
  });

  it("rounds discount percent from dollar prices", () => {
    expect(discountPercentFromPrices(7.5, 10)).toBe(25);
    expect(discountPercentFromPrices(10, 10)).toBe(0);
  });
});
