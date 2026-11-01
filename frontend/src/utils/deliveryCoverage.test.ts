import { describe, expect, it } from "vitest";
import { assessDeliveryCoverage, DELIVERY_UNAVAILABLE_MESSAGE } from "./deliveryCoverage";

const areas = [
  { postalCodePrefix: "T2W", city: "Calgary", areaNames: ["Braeside", "Woodbine"] },
  { postalCodePrefix: "T3M", city: "Calgary", areaNames: ["Cranston", "Mahogany"] },
];

describe("assessDeliveryCoverage", () => {
  it("treats a matching postal prefix as deliverable", () => {
    expect(assessDeliveryCoverage({ city: "Calgary", postalCode: "T2W 1N4" }, areas).status).toBe("open");
    expect(assessDeliveryCoverage({ city: "T2W" }, areas).status).toBe("open");
  });

  it("treats a known neighbourhood as deliverable", () => {
    expect(assessDeliveryCoverage({ city: "Cranston", label: "Cranston" }, areas).status).toBe("open");
  });

  it("asks for a postal code when only the city is known", () => {
    expect(assessDeliveryCoverage({ city: "Calgary", label: "Calgary" }, areas).status).toBe("needs-postal");
  });

  it("uses the friendly unavailable message for a postal code outside the list", () => {
    const result = assessDeliveryCoverage({ city: "Toronto", postalCode: "M5V 2T6" }, areas);
    expect(result.status).toBe("unavailable");
    expect(result.message).toBe(DELIVERY_UNAVAILABLE_MESSAGE);
  });

  it("uses the same message when the city is not served", () => {
    expect(assessDeliveryCoverage({ city: "Toronto", label: "Toronto" }, areas).message).toBe(
      DELIVERY_UNAVAILABLE_MESSAGE,
    );
  });

  it("stays open when no delivery areas are configured", () => {
    expect(assessDeliveryCoverage({ city: "Toronto" }, []).status).toBe("open");
  });
});
