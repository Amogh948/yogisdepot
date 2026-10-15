import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REGIONS } from "../../content/discovery";
import { TasteIndiaMap } from "./TasteIndiaMap";

function stubMatchMedia(canHover: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: canHover && query.includes("hover: hover"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function renderMap() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<TasteIndiaMap />} />
        <Route path="/discover/regions/:slug" element={<div>Region page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TasteIndiaMap", () => {
  beforeEach(() => {
    stubMatchMedia(true);
  });

  it("exposes all Taste India region links", () => {
    renderMap();
    for (const region of REGIONS) {
      const links = screen.getAllByRole("link", { name: new RegExp(region.name, "i") });
      expect(links.some((el) => el.getAttribute("href") === `/discover/regions/${region.slug}`)).toBe(true);
    }
    expect(screen.getByRole("img", { name: /interactive map of taste india regions/i })).toBeInTheDocument();
  });

  it("highlights a region on first tap and navigates on second tap when hover is unavailable", () => {
    stubMatchMedia(false);
    renderMap();

    const south = REGIONS.find((r) => r.slug === "south-india")!;
    const path = screen.getByRole("link", { name: new RegExp(`${south.name}:`, "i") });

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(REGIONS[0].name);

    fireEvent.click(path);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(south.name);
    expect(path).toHaveAttribute("aria-current", "true");
    expect(screen.queryByText("Region page")).not.toBeInTheDocument();

    fireEvent.click(path);
    expect(screen.getByText("Region page")).toBeInTheDocument();
  });

  it("opens the already-selected region on the first tap when hover is unavailable", () => {
    stubMatchMedia(false);
    renderMap();

    const first = REGIONS[0];
    const path = screen.getByRole("link", { name: new RegExp(`${first.name}:`, "i") });
    fireEvent.click(path);
    expect(screen.getByText("Region page")).toBeInTheDocument();
  });

  it("navigates immediately on click when hover is available", () => {
    stubMatchMedia(true);
    renderMap();

    const west = REGIONS.find((r) => r.slug === "west-india")!;
    const path = screen.getByRole("link", { name: new RegExp(`${west.name}:`, "i") });

    fireEvent.click(path);
    expect(screen.getByText("Region page")).toBeInTheDocument();
  });
});
