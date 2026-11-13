import { describe, expect, it } from "vitest";
import { groupSmsHref } from "../../lib/group-sms";

describe("groupSmsHref", () => {
  it("uses the iOS addresses parameter", () => {
    expect(
      groupSmsHref(
        ["+14045550123", "+14045550124"],
        "Hey! Carpool for Mon, Nov 9 9:30 AM",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      ),
    ).toBe(
      "sms://open?addresses=+14045550123,+14045550124&body=Hey!%20Carpool%20for%20Mon%2C%20Nov%209%209%3A30%20AM",
    );
  });

  it("uses the standard sms URI on other platforms", () => {
    expect(
      groupSmsHref(
        ["+14045550123", "+14045550124"],
        "Carpool: Campus → ATL Domestic",
        "Mozilla/5.0 (Linux; Android 15)",
      ),
    ).toBe(
      "sms:+14045550123,+14045550124?body=Carpool%3A%20Campus%20%E2%86%92%20ATL%20Domestic",
    );
  });
});
