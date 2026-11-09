import { describe, expect, it } from "vitest";
import {
  render,
  type NotificationEmailData,
} from "../../lib/notifications/render";

const notification: NotificationEmailData = {
  id: 1,
  kind: "member_joined",
  actor_name: "Casey M.",
  payload: {
    old_departs_at: "2026-11-09T14:30:00.000Z",
    new_departs_at: "2026-11-09T15:30:00.000Z",
  },
  attempts: 1,
  recipient_email: "alex@gatech.edu",
  recipient_first_name: "Alex",
  ride: {
    id: "ride-id",
    departs_at: "2026-11-09T14:30:00.000Z",
    origin_short_name: "Campus",
    destination_short_name: "ATL Domestic",
  },
};

describe("notification email rendering", () => {
  it.each([
    [
      "member_joined",
      "Casey M. joined your ride",
      "Casey M. joined your ride from Campus to ATL Domestic on Mon, Nov 9 at 9:30 AM.",
    ],
    [
      "member_left",
      "Casey M. left your ride",
      "Casey M. left your ride from Campus to ATL Domestic on Mon, Nov 9 at 9:30 AM.",
    ],
    [
      "ownership_transferred",
      "You're now the organizer of your ride",
      "You're now the organizer of the ride from Campus to ATL Domestic (Casey M. left).",
    ],
    [
      "ride_cancelled",
      "Casey M. cancelled your ride",
      "Casey M. cancelled the ride from Campus to ATL Domestic on Mon, Nov 9 at 9:30 AM.",
    ],
    [
      "time_changed",
      "Casey M. changed your ride time",
      "Casey M. moved the ride from Campus to ATL Domestic to Mon, Nov 9 at 10:30 AM (was Mon, Nov 9 at 9:30 AM).",
    ],
  ] as const)("renders %s as plain text", (kind, subject, sentence) => {
    const result = render({ ...notification, kind }, "https://gtcarpool.test/");

    expect(result).toEqual({
      subject,
      text: `${sentence}\n\nhttps://gtcarpool.test/rides/ride-id`,
    });
    expect(result.text).not.toMatch(/<[^>]+>/);
  });
});
