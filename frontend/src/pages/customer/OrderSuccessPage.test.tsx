import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderSuccessPage } from "./OrderSuccessPage";
import {
  clearOrderSuccessCelebrated,
  hasCelebratedOrderSuccess,
} from "../../store/orderSuccessUi.store";

const getOrder = vi.fn();

vi.mock("../../services/api/commerce.api", () => ({
  ordersApi: {
    get: (...args: unknown[]) => getOrder(...args),
  },
}));

vi.mock("../../hooks/useCatalog", () => ({
  useProducts: () => ({ data: { items: [] }, isLoading: false }),
}));

vi.mock("../../hooks/useCommerceActions", () => ({
  useCommerceActions: () => ({ addToCart: { mutate: vi.fn() } }),
}));

function renderPage(orderId: string, state?: { celebrateOrderId?: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/order-success",
            search: `?orderId=${orderId}`,
            state,
          },
        ]}
      >
        <Routes>
          <Route path="/order-success" element={<OrderSuccessPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const paidOrder = {
  data: {
    id: "ord-1",
    orderNumber: "YD-42",
    paymentMethod: "square" as const,
    paymentStatus: "paid",
    orderStatus: "confirmed",
    total: 24.5,
    shippingAddress: { city: "Calgary", fullName: "A", phone: "1", addressLine1: "1", state: "AB", postalCode: "T2W1A1", country: "Canada" },
    items: [],
    subtotal: 20,
    discount: 0,
    shippingFee: 0,
    tax: 0,
    createdAt: new Date().toISOString(),
  },
};

describe("OrderSuccessPage celebration", () => {
  beforeEach(() => {
    clearOrderSuccessCelebrated("ord-1");
    getOrder.mockReset();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
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

  it("triggers celebration for a confirmed paid order with navigate state", async () => {
    getOrder.mockResolvedValue(paidOrder);
    renderPage("ord-1", { celebrateOrderId: "ord-1" });
    await waitFor(() => {
      expect(screen.getByTestId("order-success-celebration")).toHaveAttribute("data-celebrating", "true");
    });
    expect(screen.getByText("YD-42")).toBeInTheDocument();
    expect(hasCelebratedOrderSuccess("ord-1")).toBe(true);
  });

  it("does not celebrate pending payment", async () => {
    getOrder.mockResolvedValue({
      data: { ...paidOrder.data, paymentStatus: "pending" },
    });
    renderPage("ord-1", { celebrateOrderId: "ord-1" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /payment processing/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("order-success-celebration")).not.toBeInTheDocument();
    expect(hasCelebratedOrderSuccess("ord-1")).toBe(false);
  });

  it("does not celebrate failed payment", async () => {
    getOrder.mockResolvedValue({
      data: { ...paidOrder.data, paymentStatus: "failed" },
    });
    renderPage("ord-1", { celebrateOrderId: "ord-1" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /payment not confirmed/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId("order-success-celebration")).not.toBeInTheDocument();
  });

  it("does not replay celebration without navigate state (refresh)", async () => {
    getOrder.mockResolvedValue(paidOrder);
    renderPage("ord-1");
    await waitFor(() => {
      expect(screen.getByTestId("order-success-celebration")).toBeInTheDocument();
    });
    expect(screen.getByTestId("order-success-celebration")).toHaveAttribute("data-celebrating", "false");
  });

  it("does not duplicate celebration when already marked", async () => {
    getOrder.mockResolvedValue(paidOrder);
    const { unmount } = renderPage("ord-1", { celebrateOrderId: "ord-1" });
    await waitFor(() => {
      expect(hasCelebratedOrderSuccess("ord-1")).toBe(true);
    });
    unmount();
    renderPage("ord-1", { celebrateOrderId: "ord-1" });
    await waitFor(() => {
      expect(screen.getByTestId("order-success-celebration")).toHaveAttribute("data-celebrating", "false");
    });
  });
});
