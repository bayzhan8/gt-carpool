import { describe, expect, it } from "vitest";
import { safeNextPath } from "../../lib/next-path";

describe("safeNextPath", () => {
  it.each([
    { path: "/rides/abc" },
    { path: "/rides/new?x=1" },
    { path: "/" },
    { path: "/%0d%0aX" },
  ])("R-AUTH-5 keeps safe same-origin paths: $path", ({ path }) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    { path: "//evil.com" },
    { path: "/\\evil.com" },
    { path: "\\\\evil" },
    { path: "https://evil.com" },
    { path: "javascript:alert(1)" },
    { path: "" },
    { path: "rides" },
    { path: "/\t/evil.com" },
    { path: "/has space" },
    { path: "/has\u0001control" },
    { path: null },
    { path: undefined },
  ])("R-AUTH-5 rejects unsafe next paths: $path", ({ path }) => {
    expect(safeNextPath(path)).toBe("/");
  });
});
