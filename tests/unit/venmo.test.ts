import { describe, expect, it } from "vitest";
import { normalizeVenmo } from "../../lib/venmo";

describe("normalizeVenmo", () => {
  it.each([
    { input: "my_handle", expected: { ok: true, value: "my_handle" } },
    { input: " @my_handle ", expected: { ok: true, value: "my_handle" } },
    { input: "", expected: { ok: true, value: null } },
    { input: "  @ ", expected: { ok: true, value: null } },
  ])(
    "R-PROF-1 normalizes optional Venmo handle: $input",
    ({ input, expected }) => {
      expect(normalizeVenmo(input)).toEqual(expected);
    },
  );

  it.each([
    { input: "tiny" },
    { input: "bad handle" },
    { input: "@@my_handle" },
    { input: "a".repeat(31) },
  ])("R-PROF-1 rejects invalid Venmo handle: $input", ({ input }) => {
    expect(normalizeVenmo(input)).toEqual({ ok: false });
  });
});
