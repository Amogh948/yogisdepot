import { describe, expect, it } from "vitest";
import { edmontonDayBounds, todayInEdmonton } from "./orderExport.service";

describe("edmontonDayBounds", () => {
  it("covers a Calgary calendar day, including a spring-forward date", () => {
    const { start, end } = edmontonDayBounds("2026-03-08");
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
    expect(start.toISOString()).toBe("2026-03-08T07:00:00.000Z");
  });

  it("rejects a date that is not a real calendar day", () => {
    expect(() => edmontonDayBounds("2026-02-31")).toThrow(/not valid/);
  });

  it("formats today in Calgary, not the server zone", () => {
    const label = todayInEdmonton(new Date("2026-01-01T06:30:00.000Z"));
    expect(label).toBe("2025-12-31");
  });
});
