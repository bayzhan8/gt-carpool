import { describe, expect, it } from "vitest";
import { formatUsPhone, normalizeUsPhone } from "../../lib/phone";

describe("normalizeUsPhone", () => {
  it.each([
    { input: "(404) 555-0123" },
    { input: "404.555.0123" },
    { input: "+1 404 555 0123" },
    { input: "14045550123" },
  ])("R-PROF-1 normalizes $input to E.164", ({ input }) => {
    expect(normalizeUsPhone(input)).toBe("+14045550123");
  });

  it.each([
    { input: "404555012" },
    { input: "+44 20 7946 0958" },
    { input: "104 555 0123" },
    { input: "404 155 0123" },
    { input: "abc" },
    { input: "" },
  ])("R-PROF-1 rejects invalid US phone input: $input", ({ input }) => {
    expect(normalizeUsPhone(input)).toBeNull();
  });
});

describe("formatUsPhone", () => {
  it("R-PROF-1 formats an E.164 phone number for display", () => {
    expect(formatUsPhone("+14045550123")).toBe("(404) 555-0123");
  });

  it("preserves values that are not valid E.164 US numbers", () => {
    expect(formatUsPhone("not-a-phone")).toBe("not-a-phone");
  });
});
