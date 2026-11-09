import { describe, expect, it } from "vitest";
import {
  atlantaDateKey,
  atlantaLocalToInstant,
  atlantaParts,
  formatDayHeader,
  formatLongDate,
  formatTime,
  next14Days,
} from "../../lib/time";

describe("atlantaLocalToInstant", () => {
  it("R-RIDE-5 rejects a nonexistent spring-forward time", () => {
    expect(atlantaLocalToInstant("2026-03-08", "02:30")).toEqual({
      ok: false,
      reason: "nonexistent",
    });
  });

  it("R-RIDE-5 chooses the earlier fall-back instant", () => {
    expect(atlantaLocalToInstant("2026-11-01", "01:30")).toEqual({
      ok: true,
      iso: "2026-11-01T05:30:00.000Z",
    });
  });

  it.each([
    ["2026-12-11", "23:30", "2026-12-12T04:30:00.000Z"],
    ["2026-07-04", "09:00", "2026-07-04T13:00:00.000Z"],
  ])("R-RIDE-5 converts %s %s to %s", (date, time, iso) => {
    expect(atlantaLocalToInstant(date, time)).toEqual({ ok: true, iso });
  });

  it.each([
    ["2026-02-30", "12:00"],
    ["2026-12-11", "24:00"],
    ["2026-12-11", "9:00"],
  ])("returns invalid for malformed local input %s %s", (date, time) => {
    expect(atlantaLocalToInstant(date, time)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("Atlanta date and time formatting", () => {
  const instant = "2026-12-12T04:30:00.000Z";

  it("R-RIDE-5 formats a local departure time", () => {
    expect(formatTime("2026-12-12T11:30:00.000Z")).toBe("6:30 AM");
  });

  it("R-RIDE-5 formats short and long local day headers", () => {
    expect(formatDayHeader(instant)).toBe("Fri, Dec 11");
    expect(formatLongDate(instant)).toBe("Friday, December 11");
  });

  it("R-RIDE-5 returns Atlanta date and local form parts", () => {
    expect(atlantaDateKey(instant)).toBe("2026-12-11");
    expect(atlantaParts(instant)).toEqual({
      date: "2026-12-11",
      time: "23:30",
    });
  });
});

describe("next14Days", () => {
  it("R-RIDE-5 returns fourteen Atlanta date keys beginning today", () => {
    expect(next14Days(new Date("2026-12-12T04:30:00.000Z"))).toEqual([
      "2026-12-11",
      "2026-12-12",
      "2026-12-13",
      "2026-12-14",
      "2026-12-15",
      "2026-12-16",
      "2026-12-17",
      "2026-12-18",
      "2026-12-19",
      "2026-12-20",
      "2026-12-21",
      "2026-12-22",
      "2026-12-23",
      "2026-12-24",
    ]);
  });
});
