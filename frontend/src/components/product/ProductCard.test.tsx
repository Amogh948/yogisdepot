import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ProductCard } from "./ProductCard";
import { QuantitySelector } from "../ui/Feedback";
import type { Product } from "../../types";

function renderCard(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const product: Product = {
  name: "Masala Chips",
  slug: "masala-chips",
  description: "Crispy",
  sku: "X1",
  vendorId: "v1",
  categoryId: "c1",
  images: [],
  price: 49,
  discount: 10,
  stock: 5,
  lowStockThreshold: 2,
  unit: "pack",
  tags: [],
  isVegetarian: true,
  isVegan: false,
  isFeatured: false,
  isActive: true,
  rating: 4.5,
  reviewCount: 12,
};

describe("ProductCard", () => {
  it("renders name and price", () => {
    renderCard(<ProductCard product={product} />);
    expect(screen.getByText("Masala Chips")).toBeInTheDocument();
    expect(screen.getByText("₹49")).toBeInTheDocument();
  });
});

describe("QuantitySelector", () => {
  it("exposes accessible increment and decrement controls", () => {
    render(<QuantitySelector value={2} onChange={() => undefined} />);
    expect(screen.getByLabelText("Decrease quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Increase quantity")).toBeInTheDocument();
  });
});
