import { describe, expect, it } from "vitest";
import {
  FESTIVAL_PALETTES,
  festivalThemeCssVars,
  inferFestivalTheme,
  resolveFestivalTheme,
} from "./festivalThemes";

describe("inferFestivalTheme", () => {
  it("detects diwali keywords", () => {
    expect(inferFestivalTheme("diwali-sweets")).toBe("diwali");
    expect(inferFestivalTheme("Deepavali Special")).toBe("diwali");
  });

  it("detects navratri keywords", () => {
    expect(inferFestivalTheme("navratri-garba")).toBe("navratri");
    expect(inferFestivalTheme("Durga Puja")).toBe("navratri");
  });

  it("falls back to generic", () => {
    expect(inferFestivalTheme("onam-feast")).toBe("generic");
    expect(inferFestivalTheme("")).toBe("generic");
  });
});

describe("resolveFestivalTheme", () => {
  it("prefers explicit admin theme", () => {
    expect(resolveFestivalTheme("holi", "diwali-sale", "Diwali")).toBe("holi");
  });

  it("infers from slug when unset", () => {
    expect(resolveFestivalTheme(undefined, "eid-mubarak", "Celebration")).toBe("eid");
  });
});

describe("festivalThemeCssVars", () => {
  it("exposes palette tokens for dynamic page theming", () => {
    const vars = festivalThemeCssVars("navratri");
    expect(vars["--fest-bg"]).toBe(FESTIVAL_PALETTES.navratri.bg);
    expect(vars["--fest-accent"]).toBe(FESTIVAL_PALETTES.navratri.accent);
    expect(vars["--fest-highlight"]).toBe(FESTIVAL_PALETTES.navratri.highlight);
  });
});
