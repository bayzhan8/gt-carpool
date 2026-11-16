import { describe, expect, it } from "vitest";
import { placeKey } from "../../lib/place-key";

describe("placeKey", () => {
  it("normalizes accents, case, whitespace, and punctuation", () => {
    expect(placeKey("  MERCEDES—Benz   Stadium ")).toBe(
      "mercedes benz stadium",
    );
    expect(placeKey("Cafe\u0301 de Paris")).toBe("café de paris");
  });

  it("matches the same key for punctuation variants", () => {
    expect(placeKey("Athens, GA")).toBe(placeKey("athens ga"));
  });
});
