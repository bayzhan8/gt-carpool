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
      "You're now the owner of your ride",
      "You're now the owner of the ride from Campus to ATL Domestic on Mon, Nov 9 at 9:30 AM (Casey M. left).",
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

  it.each([
    [
      "today",
      "2026-11-14T12:15:00.000Z",
      "Reminder: your ride is today at 7:15 AM",
      "Your ride from Campus to ATL Domestic leaves today at 7:15 AM. If you haven't yet, start a group chat with your riders and agree where to meet and who orders the Uber or Lyft.",
      new Date("2026-11-14T15:00:00.000Z"),
    ],
    [
      "tomorrow",
      "2026-11-15T12:15:00.000Z",
      "Reminder: your ride is tomorrow at 7:15 AM",
      "Your ride from Campus to ATL Domestic leaves tomorrow at 7:15 AM. If you haven't yet, start a group chat with your riders and agree where to meet and who orders the Uber or Lyft.",
      new Date("2026-11-14T15:00:00.000Z"),
    ],
    [
      "another day",
      "2026-11-16T12:15:00.000Z",
      "Reminder: your ride is Mon, Nov 16 at 7:15 AM",
      "Your ride from Campus to ATL Domestic leaves Mon, Nov 16 at 7:15 AM. If you haven't yet, start a group chat with your riders and agree where to meet and who orders the Uber or Lyft.",
      new Date("2026-11-14T15:00:00.000Z"),
    ],
    [
      "across the DST boundary",
      "2026-11-01T12:15:00.000Z",
      "Reminder: your ride is today at 7:15 AM",
      "Your ride from Campus to ATL Domestic leaves today at 7:15 AM. If you haven't yet, start a group chat with your riders and agree where to meet and who orders the Uber or Lyft.",
      new Date("2026-11-01T04:30:00.000Z"),
    ],
  ] as const)(
    "renders a reminder for %s using Atlanta dates",
    (_case, departsAt, subject, sentence, now) => {
      const result = render(
        {
          ...notification,
          kind: "ride_reminder",
          ride: { ...notification.ride, departs_at: departsAt },
        },
        "https://gtcarpool.test/",
        now,
      );

      expect(result).toEqual({
        subject,
        text: `${sentence}\n\nhttps://gtcarpool.test/rides/ride-id`,
      });
    },
  );
});
