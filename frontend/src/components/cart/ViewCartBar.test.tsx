import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { ViewCartBar } from "./ViewCartBar";
import { useGuestCartStore } from "../../store/guestCart.store";
import { useAuthStore } from "../../store/auth.store";

function renderBar(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ViewCartBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ViewCartBar", () => {
  beforeEach(() => {
    useGuestCartStore.setState({ items: [] });
    useAuthStore.setState({ user: null, bootstrapped: true });
  });

  it("is hidden when the cart is empty", () => {
    renderBar("/");
    expect(screen.queryByRole("link", { name: /view cart/i })).not.toBeInTheDocument();
  });

  it("appears with item count when the guest cart has products", () => {
    useGuestCartStore.setState({
      items: [
        { productId: "a", quantity: 1, image: "/a.jpg", name: "A" },
        { productId: "b", quantity: 2, image: "/b.jpg", name: "B" },
      ],
    });
    renderBar("/");
    const link = screen.getByRole("link", { name: /view cart, 3 items/i });
    expect(link).toHaveAttribute("href", "/cart");
    expect(screen.getByText("View cart")).toBeInTheDocument();
    expect(screen.getByText("3 Items")).toBeInTheDocument();
  });

  it("hides on the cart page even when items exist", () => {
    useGuestCartStore.setState({
      items: [{ productId: "a", quantity: 1, image: "/a.jpg" }],
    });
    renderBar("/cart");
    expect(screen.queryByRole("link", { name: /view cart/i })).not.toBeInTheDocument();
  });

  it("hides on checkout", () => {
    useGuestCartStore.setState({
      items: [{ productId: "a", quantity: 2 }],
    });
    renderBar("/checkout");
    expect(screen.queryByRole("link", { name: /view cart/i })).not.toBeInTheDocument();
  });
});
