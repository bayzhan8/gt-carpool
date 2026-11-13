"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { atlantaDateKey, formatDayHeader } from "@/lib/time";
import type { RideCard as RideCardData } from "@/lib/rides";
import {
  browseHref,
  filterRides,
  parseBrowseParams,
  type BrowseState,
  type TimeBucket,
} from "@/lib/ride-filters";
import { RideCard } from "./rides/ride-card";
import type { OnlyAudience } from "@/lib/ride-filters";

type RideBrowserProps = {
  initial: BrowseState;
  airport: RideCardData[];
  campus: RideCardData[];
  days: string[];
  viewerAudience: OnlyAudience | null;
};

const timeOptions: { value: TimeBucket | null; label: string }[] = [
  { value: null, label: "Any time" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Late night" },
];

const seatOptions = [
  { value: null, label: "Any seats", accessibleLabel: "Any seats" },
  { value: 1, label: "1+", accessibleLabel: "1+ seats" },
  { value: 2, label: "2+", accessibleLabel: "2+ seats" },
  { value: 3, label: "3+", accessibleLabel: "3+ seats" },
];

const browseLocationChangeEvent = "gt-carpool:browse-location-change";

function subscribeToLocationChanges(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(browseLocationChangeEvent, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(browseLocationChangeEvent, callback);
  };
}

function getLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return null;
}

function browseStateFromSearch(search: string): BrowseState {
  const params = new URLSearchParams(search);
  return parseBrowseParams({
    dir: params.get("dir") ?? undefined,
    day: params.get("day") ?? undefined,
    time: params.get("time") ?? undefined,
    seats: params.get("seats") ?? undefined,
    only: params.get("only") ?? undefined,
  });
}

function postRideHref(dir: BrowseState["dir"], day: string | null): string {
  const params = new URLSearchParams({ dir });
  if (day) params.set("date", day);
  return `/rides/new?${params.toString()}`;
}

function handleLocalLink(
  event: MouseEvent<HTMLAnchorElement>,
  next: BrowseState,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  window.history.replaceState(window.history.state, "", browseHref(next));
  window.dispatchEvent(new Event(browseLocationChangeEvent));
}

function handleToggleSpace(event: KeyboardEvent<HTMLAnchorElement>) {
  if (event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
  }
}

export function RideBrowser({
  initial,
  airport,
  campus,
  days,
  viewerAudience,
}: RideBrowserProps) {
  const locationSearch = useSyncExternalStore(
    subscribeToLocationChanges,
    getLocationSearch,
    getServerLocationSearch,
  );
  const parsedState =
    locationSearch === null ? initial : browseStateFromSearch(locationSearch);
  const state: BrowseState =
    parsedState.only && parsedState.only === viewerAudience
      ? parsedState
      : { ...parsedState, only: null };
  const clearedState: BrowseState = {
    ...state,
    day: null,
    time: null,
    minSeats: null,
    only: null,
  };
  const activeDayRef = useRef<HTMLAnchorElement>(null);
  const directionRides = state.dir === "airport" ? airport : campus;
  const visibleRides = filterRides(directionRides, state);
  const daysWithRides = new Set(
    directionRides.map((ride) => atlantaDateKey(ride.departs_at)),
  );
  const groups = new Map<string, RideCardData[]>();

  for (const ride of visibleRides) {
    const key = atlantaDateKey(ride.departs_at);
    groups.set(key, [...(groups.get(key) ?? []), ride]);
  }

  useEffect(() => {
    const chip = activeDayRef.current;
    const nav = chip?.parentElement;
    if (!chip || !nav) return;
    const chipBox = chip.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    nav.scrollTo({
      left:
        nav.scrollLeft +
        chipBox.left -
        navBox.left -
        (nav.clientWidth - chipBox.width) / 2,
    });
  }, [state.day]);

  const postHref = postRideHref(state.dir, state.day);

  return (
    <section className="pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rides</h1>
          <p className="mt-2 text-sm text-muted">
            {state.dir === "airport"
              ? "Find or share a ride to the airport."
              : "Find or share a ride back to campus."}
          </p>
        </div>
        <a
          className="hidden min-h-11 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-white sm:inline-flex"
          href={postHref}
        >
          Post a ride
        </a>
      </div>

      <nav
        aria-label="Ride direction"
        className="mt-6 grid grid-cols-2 rounded-[10px] bg-surface p-1"
      >
        {(["airport", "campus"] as const).map((value) => {
          const next = { ...state, dir: value };
          return (
            <a
              aria-current={state.dir === value ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-[8px] text-sm font-medium ${
                state.dir === value ? "bg-white shadow-sm" : "text-muted"
              }`}
              href={browseHref(next)}
              key={value}
              onClick={(event) => handleLocalLink(event, next)}
            >
              {value === "airport" ? "To the airport" : "To campus"}
            </a>
          );
        })}
      </nav>

      <nav
        aria-label="Departure day"
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {[null, ...days].map((date) => {
          const next = { ...state, day: date };
          return (
            <a
              aria-current={state.day === date ? "date" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm ${
                state.day === date
                  ? "border-primary bg-primary text-white"
                  : "border-hairline"
              }`}
              href={browseHref(next)}
              key={date ?? "any-day"}
              onClick={(event) => handleLocalLink(event, next)}
              ref={state.day === date ? activeDayRef : undefined}
            >
              {date ? formatDayHeader(`${date}T17:00:00.000Z`) : "Any day"}
              {date && daysWithRides.has(date) ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-accent"
                />
              ) : null}
            </a>
          );
        })}
      </nav>

      <div className="-mx-4 mt-1 flex items-center gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {viewerAudience ? (
          <div className="order-first flex shrink-0 items-center gap-2 sm:order-last">
            <span
              aria-hidden="true"
              className="hidden h-6 shrink-0 border-l border-hairline sm:block"
            />
            {(() => {
              const active = state.only === viewerAudience;
              const next = { ...state, only: active ? null : viewerAudience };
              const label =
                viewerAudience === "women" ? "Women only" : "Men only";
              return (
                <a
                  aria-label={`Show only ${label.toLowerCase()} rides`}
                  aria-pressed={active}
                  className={`flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs font-medium sm:text-sm ${
                    active
                      ? viewerAudience === "women"
                        ? "border-pink-400 bg-pink-200 text-pink-900"
                        : "border-sky-400 bg-sky-200 text-sky-900"
                      : viewerAudience === "women"
                        ? "border-pink-200 bg-white text-pink-700"
                        : "border-sky-200 bg-white text-sky-700"
                  }`}
                  href={browseHref(next)}
                  onClick={(event) => handleLocalLink(event, next)}
                  onKeyDown={handleToggleSpace}
                  role="button"
                >
                  {label}
                </a>
              );
            })()}
            <span
              aria-hidden="true"
              className="h-6 shrink-0 border-l border-hairline sm:hidden"
            />
          </div>
        ) : null}
        <div
          aria-label="Filter by time"
          className="flex shrink-0 gap-2"
          role="group"
        >
          {timeOptions.map(({ value, label }) => {
            const next = { ...state, time: value };
            return (
              <a
                aria-label={label}
                aria-pressed={state.time === value}
                className={`flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs sm:text-sm ${
                  state.time === value
                    ? "border-primary bg-primary text-white"
                    : "border-hairline"
                }`}
                href={browseHref(next)}
                key={label}
                onClick={(event) => handleLocalLink(event, next)}
                onKeyDown={handleToggleSpace}
                role="button"
              >
                {label}
              </a>
            );
          })}
        </div>
        <span
          aria-hidden="true"
          className="h-6 shrink-0 border-l border-hairline"
        />
        <div
          aria-label="Filter by seats"
          className="flex shrink-0 gap-2"
          role="group"
        >
          {seatOptions.map(({ value, label, accessibleLabel }) => {
            const next = { ...state, minSeats: value };
            return (
              <a
                aria-label={accessibleLabel}
                aria-pressed={state.minSeats === value}
                className={`flex min-h-11 shrink-0 items-center rounded-full border px-3 text-xs sm:text-sm ${
                  state.minSeats === value
                    ? "border-primary bg-primary text-white"
                    : "border-hairline"
                }`}
                href={browseHref(next)}
                key={accessibleLabel}
                onClick={(event) => handleLocalLink(event, next)}
                onKeyDown={handleToggleSpace}
                role="button"
              >
                {label}
              </a>
            );
          })}
        </div>
      </div>

      {directionRides.length === 0 ? (
        <div className="mt-8 min-h-[60svh] rounded-[12px] border border-hairline p-6 text-center">
          <p className="font-medium">
            No rides yet. Post one and others can join.
          </p>
          <a
            className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 font-medium text-white"
            href={postHref}
          >
            Post a ride
          </a>
        </div>
      ) : visibleRides.length === 0 ? (
        <div className="mt-8 min-h-[60svh] rounded-[12px] border border-hairline p-6 text-center">
          <p className="font-medium">
            {state.only
              ? `No ${state.only === "women" ? "women" : "men"}-only rides match yet.`
              : "No rides match these filters."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <a
              className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-4 text-sm font-medium"
              href={browseHref(clearedState)}
              onClick={(event) => handleLocalLink(event, clearedState)}
            >
              Clear filters
            </a>
            <a
              className="inline-flex min-h-11 items-center rounded-[10px] bg-primary px-4 font-medium text-white"
              href={postHref}
            >
              Post a ride
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-8 min-h-[60svh] space-y-7">
          {Array.from(groups, ([date, dayRides]) => (
            <section
              aria-label={formatDayHeader(`${date}T17:00:00.000Z`)}
              key={date}
            >
              <h2 className="mb-3 text-sm font-semibold text-muted">
                {formatDayHeader(`${date}T17:00:00.000Z`)}
              </h2>
              <div className="space-y-3">
                {dayRides.map((ride) => (
                  <RideCard key={ride.id} ride={ride} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-white/95 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:hidden">
        <a
          className="mx-auto flex min-h-11 max-w-[560px] items-center justify-center rounded-[10px] bg-primary px-4 font-medium text-white"
          href={postHref}
        >
          Post a ride
        </a>
      </div>
    </section>
  );
}
