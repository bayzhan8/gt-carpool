import { describe, expect, it } from "vitest";
import { isEmailShaped, normalizeEmail } from "../../lib/email";

describe("normalizeEmail", () => {
  it("[R-AUTH-3] trims whitespace and lowercases email addresses", () => {
    expect(normalizeEmail(" Name@GATECH.EDU ")).toBe("name@gatech.edu");
  });
});

describe("isEmailShaped", () => {
  it.each([
    ["name@gatech.edu", true],
    ["guest.rider@example.com", true],
    [" Name@Example.com ", true],
    ["a@b", true],
    ["", false],
    ["example.com", false],
    ["@example.com", false],
    ["user@", false],
    ["a@@b.com", false],
    ["name with space@example.com", false],
  ] as const)(
    "[R-AUTH-2] identifies %s as email-shaped: %s",
    (email, expected) => {
      expect(isEmailShaped(email)).toBe(expected);
    },
  );
});
