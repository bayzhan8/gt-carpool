import { describe, expect, it } from "vitest";
import { formatMix } from "../../lib/comfort";

describe("R-COMFORT-6 member mix display", () => {
  it("omits the mix when there are no men or women", () => {
    expect(formatMix({ men: 0, women: 0 })).toBeNull();
  });

  it("renders only the nonzero group", () => {
    expect(formatMix({ men: 3, women: 0 })).toBe("3 men");
    expect(formatMix({ men: 0, women: 1 })).toBe("1 woman");
  });

  it("renders both groups with singular and plural labels", () => {
    expect(formatMix({ men: 2, women: 1 })).toBe("1 woman · 2 men");
  });
});
