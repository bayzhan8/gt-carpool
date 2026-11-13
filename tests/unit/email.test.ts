import { describe, expect, it } from "vitest";
import { isGatechEmail, normalizeEmail } from "../../lib/email";

describe("normalizeEmail", () => {
  it("[R-AUTH-3] trims whitespace and lowercases email addresses", () => {
    expect(normalizeEmail(" Name@GATECH.EDU ")).toBe("name@gatech.edu");
  });
});

describe("isGatechEmail", () => {
  it.each([
    ["name@gatech.edu", true],
    ["Name@GATECH.EDU ", true],
    ["name@cc.gatech.edu", true],
    ["name@a.cc.gatech.edu", true],
    ["x@gatech.edu.evil.com", false],
    ["x@evilgatech.edu", false],
    ["a@b@gatech.edu", false],
    ["@gatech.edu", false],
    ["name with space@gatech.edu", false],
    ["x@.gatech.edu", false],
    ["x@gatech.edu.", false],
    ["name@sub_domain.gatech.edu", false],
  ] as const)("[R-AUTH-2] validates %s as %s", (email, expected) => {
    expect(isGatechEmail(email)).toBe(expected);
  });
});
