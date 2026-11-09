import { describe, expect, it } from "vitest";
import { formatMix } from "../../lib/comfort";

describe("R-COMFORT-6 member mix display", () => {
  it("uses singular labels for one brother and one sister", () => {
    expect(formatMix({ brothers: 1, sisters: 1 })).toBe("1 brother · 1 sister");
  });

  it("pluralizes group counts", () => {
    expect(formatMix({ brothers: 2, sisters: 3 })).toBe(
      "2 brothers · 3 sisters",
    );
  });
});
