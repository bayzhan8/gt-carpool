import { describe, expect, it } from "vitest";
import { authErrorCopy, DB_ERROR_KEYS, errorCopy } from "../../lib/errors";

describe("errorCopy", () => {
  it("R-AUTH-4 gives every database error key its own copy", () => {
    const messages = DB_ERROR_KEYS.map((key) => errorCopy(key));

    expect(messages).not.toContain("Something went wrong. Try again.");
    expect(new Set(messages).size).toBe(DB_ERROR_KEYS.length);
  });

  it("R-AUTH-4 uses fallback copy for unknown keys", () => {
    expect(errorCopy("unknown")).toBe("Something went wrong. Try again.");
  });
});

describe("authErrorCopy", () => {
  it.each([
    {
      error: { status: 429 },
      expected: "Too many attempts. Wait a minute and try again.",
    },
    {
      error: { code: "over_email_send_rate_limit" },
      expected: "Too many attempts. Wait a minute and try again.",
    },
    {
      error: { code: "over_request_rate_limit" },
      expected: "Too many attempts. Wait a minute and try again.",
    },
  ])(
    "R-AUTH-1 maps rate-limit errors to retry guidance",
    ({ error, expected }) => {
      expect(authErrorCopy(error)).toBe(expected);
    },
  );

  it("R-AUTH-2 maps the before-user-created rejection", () => {
    expect(
      authErrorCopy({ status: 403, message: "Use your @gatech.edu email." }),
    ).toBe("Use your @gatech.edu email.");
  });

  it.each([{ status: 403 }, { code: "otp_expired" }])(
    "R-AUTH-1 maps invalid or expired OTP errors",
    (error) => {
      expect(authErrorCopy(error)).toBe("That code is wrong or expired.");
    },
  );

  it("R-AUTH-1 uses fallback copy for other GoTrue errors", () => {
    expect(authErrorCopy({ status: 500 })).toBe(
      "Something went wrong. Try again.",
    );
  });
});
