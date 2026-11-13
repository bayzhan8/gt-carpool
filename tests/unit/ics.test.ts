import { afterEach, describe, expect, it, vi } from "vitest";
import { buildIcs } from "../../lib/ics";

afterEach(() => {
  vi.useRealTimers();
});

describe("buildIcs", () => {
  it("builds a UTC event with a 30-minute end time and CRLF lines", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00.000Z"));

    expect(
      buildIcs({
        uid: "ride-1@gt-carpool",
        start: "2026-11-09T14:30:00.000Z",
        minutes: 30,
        summary: "Carpool: Campus → ATL Domestic",
        location: "North Ave NW, Atlanta, GA 30332",
        description: "https://rides.example/rides/ride-1",
        url: "https://rides.example/rides/ride-1",
      }),
    ).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GT Carpool//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        "UID:ride-1@gt-carpool",
        "DTSTAMP:20261109T120000Z",
        "DTSTART:20261109T143000Z",
        "DTEND:20261109T150000Z",
        "SUMMARY:Carpool: Campus → ATL Domestic",
        "LOCATION:North Ave NW\\, Atlanta\\, GA 30332",
        "DESCRIPTION:https://rides.example/rides/ride-1",
        "URL:https://rides.example/rides/ride-1",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
      ].join("\r\n"),
    );
  });

  it("escapes text values", () => {
    const calendar = buildIcs({
      uid: "ride-2@gt-carpool",
      start: "2026-11-09T14:30:00Z",
      minutes: 30,
      summary: "A, B; C\\D",
      location: "Line one\nLine two",
      description: "A; B, C\\D",
      url: "https://rides.example/rides/ride-2",
    });

    expect(calendar).toContain("SUMMARY:A\\, B\\; C\\\\D\r\n");
    expect(calendar).toContain("LOCATION:Line one\\nLine two\r\n");
    expect(calendar).toContain("DESCRIPTION:A\\; B\\, C\\\\D\r\n");
  });

  it("folds physical lines at 75 UTF-8 octets without splitting characters", () => {
    const calendar = buildIcs({
      uid: "ride-3@gt-carpool",
      start: "2026-11-09T14:30:00Z",
      minutes: 30,
      summary: `Carpool ${"🛫".repeat(40)}`,
      location: "Campus",
      description: "https://rides.example/rides/ride-3",
      url: "https://rides.example/rides/ride-3",
    });

    for (const line of calendar.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(calendar).toContain("\r\n ");
  });
});
