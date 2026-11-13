import { describe, expect, it } from "vitest";
import { DEMO_EMAIL_DOMAIN, isDemoEmail } from "../../lib/demo";

describe("demo email addresses", () => {
  it("matches the demo domain case-insensitively", () => {
    expect(DEMO_EMAIL_DOMAIN).toBe("carpool-demo.gatech.edu");
    expect(isDemoEmail("demo1@carpool-demo.gatech.edu")).toBe(true);
    expect(isDemoEmail("Demo1@CARPOOL-DEMO.GATECH.EDU")).toBe(true);
  });

  it("does not classify regular GT addresses as demo accounts", () => {
    expect(isDemoEmail("demo1@gatech.edu")).toBe(false);
  });
});
