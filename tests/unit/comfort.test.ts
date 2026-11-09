import { describe, expect, it } from "vitest";
import { formatMix } from "../../lib/comfort";

describe("R-COMFORT-6 member mix display", () => {
  it("uses singular labels for one woman and one man", () => {
    expect(formatMix({ men: 1, women: 1 })).toBe("1 woman · 1 man");
  });

  it("pluralizes group counts", () => {
    expect(formatMix({ men: 2, women: 3 })).toBe("3 women · 2 men");
  });
});
