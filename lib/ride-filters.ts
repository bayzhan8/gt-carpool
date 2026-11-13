import { atlantaDateKey, atlantaParts } from "./time";
import type { RideAudience, RideDirection } from "./rides";

export type TimeBucket = "morning" | "afternoon" | "evening" | "night";

export type BrowseState = {
  dir: RideDirection;
  day: string | null;
  time: TimeBucket | null;
  minSeats: number | null;
  only: OnlyAudience | null;
};

export type OnlyAudience = Exclude<RideAudience, "anyone">;

export type BrowseParams = {
  dir?: string | readonly string[];
  day?: string | readonly string[];
  time?: string | readonly string[];
  seats?: string | readonly string[];
  only?: string | readonly string[];
};

const timeBuckets = new Set<TimeBucket>([
  "morning",
  "afternoon",
  "evening",
  "night",
]);

export function timeBucket(departsAt: string): TimeBucket {
  const hour = Number(atlantaParts(departsAt).time.slice(0, 2));

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function filterRides<
  T extends { departs_at: string; seats_left: number; audience?: RideAudience },
>(
  rides: T[],
  filters: {
    day: string | null;
    time: TimeBucket | null;
    minSeats: number | null;
    only?: OnlyAudience | null;
  },
): T[] {
  return rides.filter(
    (ride) =>
      (!filters.day || atlantaDateKey(ride.departs_at) === filters.day) &&
      (!filters.time || timeBucket(ride.departs_at) === filters.time) &&
      (filters.minSeats === null || ride.seats_left >= filters.minSeats) &&
      (!filters.only || ride.audience === filters.only),
  );
}

export function validDay(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

export function parseBrowseParams(params: BrowseParams): BrowseState {
  const dir: RideDirection = params.dir === "campus" ? "campus" : "airport";
  const day = typeof params.day === "string" ? validDay(params.day) : null;
  const time =
    typeof params.time === "string" &&
    timeBuckets.has(params.time as TimeBucket)
      ? (params.time as TimeBucket)
      : null;
  const seats =
    typeof params.seats === "string" && /^[1-5]$/.test(params.seats)
      ? Number(params.seats)
      : null;
  const only =
    params.only === "women" || params.only === "men" ? params.only : null;

  return { dir, day, time, minSeats: seats, only };
}

export function browseHref(state: BrowseState): string {
  const params = new URLSearchParams({ dir: state.dir });

  if (state.day) params.set("day", state.day);
  if (state.time) params.set("time", state.time);
  if (state.minSeats !== null) {
    params.set("seats", String(state.minSeats));
  }
  if (state.only) params.set("only", state.only);

  return `/?${params.toString()}`;
}
