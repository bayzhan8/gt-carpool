import { describe, expect, it } from "vitest";
import {
  browseHref,
  filterRides,
  parseBrowseParams,
  timeBucket,
} from "../../lib/ride-filters";

describe("Atlanta departure time buckets", () => {
  it.each([
    ["2026-11-12T09:59:00.000Z", "night"],
    ["2026-11-12T10:00:00.000Z", "morning"],
    ["2026-11-12T16:59:00.000Z", "morning"],
    ["2026-11-12T17:00:00.000Z", "afternoon"],
    ["2026-11-12T21:59:00.000Z", "afternoon"],
    ["2026-11-12T22:00:00.000Z", "evening"],
    ["2026-11-13T02:59:00.000Z", "evening"],
    ["2026-11-13T03:00:00.000Z", "night"],
    ["2026-11-01T05:30:00.000Z", "night"],
    ["2026-11-01T06:30:00.000Z", "night"],
    ["2026-11-01T17:00:00.000Z", "afternoon"],
  ] as const)("classifies %s as %s", (departsAt, expected) => {
    expect(timeBucket(departsAt)).toBe(expected);
  });

  it("uses the Atlanta day across a UTC date boundary", () => {
    const ride = {
      departs_at: "2026-11-13T03:00:00.000Z",
      seats_left: 2,
    };

    expect(timeBucket(ride.departs_at)).toBe("night");
    expect(
      filterRides([ride], {
        day: "2026-11-12",
        time: "night",
        minSeats: null,
      }),
    ).toEqual([ride]);
  });
});

describe("filterRides", () => {
  const rides = [
    { id: "full", departs_at: "2026-11-12T14:00:00.000Z", seats_left: 0 },
    { id: "morning", departs_at: "2026-11-12T15:00:00.000Z", seats_left: 1 },
    { id: "evening", departs_at: "2026-11-12T23:00:00.000Z", seats_left: 3 },
    { id: "next-day", departs_at: "2026-11-13T03:00:00.000Z", seats_left: 4 },
  ];

  it("combines day, time, and minimum-seat filters", () => {
    expect(
      filterRides(rides, {
        day: "2026-11-12",
        time: "morning",
        minSeats: 1,
      }).map(({ id }) => id),
    ).toEqual(["morning"]);
  });

  it("hides full rides when a minimum-seat filter is set", () => {
    expect(
      filterRides(rides, { day: null, time: null, minSeats: 1 }).map(
        ({ id }) => id,
      ),
    ).toEqual(["morning", "evening", "next-day"]);
  });

  it("keeps only rides for the selected audience", () => {
    const audienceRides = [
      {
        id: "anyone",
        departs_at: "2026-11-12T15:00:00.000Z",
        seats_left: 1,
        audience: "anyone" as const,
      },
      {
        id: "women",
        departs_at: "2026-11-12T16:00:00.000Z",
        seats_left: 1,
        audience: "women" as const,
      },
      {
        id: "men",
        departs_at: "2026-11-12T17:00:00.000Z",
        seats_left: 1,
        audience: "men" as const,
      },
    ];
    expect(
      filterRides(audienceRides, {
        day: null,
        time: null,
        minSeats: null,
        only: "women",
      }).map(({ id }) => id),
    ).toEqual(["women"]);
    expect(
      filterRides(audienceRides, {
        day: null,
        time: null,
        minSeats: null,
        only: null,
      }),
    ).toEqual(audienceRides);
  });

  it("leaves rides unchanged when filters are cleared", () => {
    expect(
      filterRides(rides, { day: null, time: null, minSeats: null }),
    ).toEqual(rides);
  });
});

describe("parseBrowseParams", () => {
  it.each(["1", "5"])("accepts a minimum seat count of %s", (seats) => {
    expect(parseBrowseParams({ seats }).minSeats).toBe(Number(seats));
  });

  it.each([
    [
      { dir: ["campus", "airport"] },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
    [
      { dir: ["campus"], day: ["2026-11-12"], time: ["night"], seats: ["2"] },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
    [
      { seats: "0" },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
    [
      { seats: "9" },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
    [
      { time: "lunch" },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
    [
      { day: "2026-02-30" },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
    [
      { day: ["2026-11-12"] },
      { dir: "airport", day: null, time: null, minSeats: null, only: null },
    ],
  ] as const)("rejects invalid browse parameters %j", (params, expected) => {
    expect(parseBrowseParams(params)).toEqual(expected);
  });

  it.each([
    ["women", "women"],
    ["men", "men"],
    ["anyone", null],
    ["WOMEN", null],
  ] as const)("parses only=%s as %s", (only, expected) => {
    expect(parseBrowseParams({ only }).only).toBe(expected);
  });

  it("parses valid state and falls back only for invalid values", () => {
    expect(
      parseBrowseParams({
        dir: "campus",
        day: "2026-11-12",
        time: "night",
        seats: "3",
      }),
    ).toEqual({
      dir: "campus",
      day: "2026-11-12",
      time: "night",
      minSeats: 3,
      only: null,
    });
    expect(
      parseBrowseParams({
        dir: "campus",
        day: "bad",
        time: "lunch",
        seats: "0",
      }),
    ).toEqual({
      dir: "campus",
      day: null,
      time: null,
      minSeats: null,
      only: null,
    });
  });
});

describe("browseHref", () => {
  it("omits null filter keys", () => {
    expect(
      browseHref({
        dir: "airport",
        day: null,
        time: null,
        minSeats: null,
        only: null,
      }),
    ).toBe("/?dir=airport");
  });

  it("serializes selected filters", () => {
    expect(
      browseHref({
        dir: "campus",
        day: "2026-11-12",
        time: "night",
        minSeats: 2,
        only: null,
      }),
    ).toBe("/?dir=campus&day=2026-11-12&time=night&seats=2");
    expect(
      browseHref({
        dir: "airport",
        day: null,
        time: null,
        minSeats: null,
        only: "women",
      }),
    ).toBe("/?dir=airport&only=women");
  });
});
