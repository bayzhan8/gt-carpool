"use client";

import { useActionState, useEffect, useState } from "react";
import { atlantaLocalToInstant } from "@/lib/time";
import type { RideCard as RideCardData } from "@/lib/rides";
import type { RideAudience } from "@/lib/rides";
import { RideCard } from "../ride-card";
import {
  createRideAction,
  findSimilarRidesAction,
  type CreateRideState,
} from "./actions";

const places = [
  { slug: "gt", name: "Campus", kind: "campus" },
  { slug: "atl-domestic", name: "ATL Domestic", kind: "airport" },
  { slug: "atl-intl", name: "ATL International", kind: "airport" },
] as const;

const initialState: CreateRideState = {};

type RideFormProps = {
  initialDate: string;
  initialTime: string;
  initialAudience: RideAudience;
};

export function RideForm({
  initialDate,
  initialTime,
  initialAudience,
}: RideFormProps) {
  const [state, action, pending] = useActionState(
    createRideAction,
    initialState,
  );
  const [origin, setOrigin] = useState("gt");
  const [destination, setDestination] = useState("atl-domestic");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [seats, setSeats] = useState(4);
  const [notes, setNotes] = useState("");
  const [audience, setAudience] = useState<RideAudience>(initialAudience);
  const [suggestionState, setSuggestionState] = useState<{
    key: string;
    rides: RideCardData[];
  }>({ key: "", rides: [] });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const requestKey = `${origin}|${destination}|${date}|${time}`;
  const isValidLocalTime = atlantaLocalToInstant(date, time).ok;
  const suggestions =
    suggestionState.key === requestKey ? suggestionState.rides : [];

  useEffect(() => {
    if (!atlantaLocalToInstant(date, time).ok) return;

    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const rides = await findSimilarRidesAction(
          origin,
          destination,
          date,
          time,
        );
        setSuggestionState({ key: requestKey, rides });
      } catch {
        setSuggestionState({ key: requestKey, rides: [] });
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [date, destination, origin, requestKey, time]);

  function changeOrigin(value: string) {
    setOrigin(value);
    const selected = places.find((place) => place.slug === value);
    if (selected?.kind === "airport") {
      setDestination("gt");
    } else if (destination === "gt") {
      setDestination("atl-domestic");
    }
  }

  function changeDestination(value: string) {
    setDestination(value);
    const selected = places.find((place) => place.slug === value);
    if (selected?.kind === "airport") {
      setOrigin("gt");
    } else if (origin === "gt") {
      setOrigin("atl-domestic");
    }
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-muted"
            htmlFor="origin"
          >
            From
          </label>
          <select
            className="min-h-11 w-full rounded-[10px] border border-hairline bg-white px-3 text-base"
            id="origin"
            name="origin"
            onChange={(event) => changeOrigin(event.target.value)}
            value={origin}
          >
            {places.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.name}
              </option>
            ))}
          </select>
        </div>
        <button
          aria-label="Swap route"
          className="mb-0.5 flex size-11 items-center justify-center rounded-full border border-hairline"
          onClick={(event) => {
            event.preventDefault();
            setOrigin(destination);
            setDestination(origin);
          }}
          type="button"
        >
          ⇄
        </button>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-muted"
            htmlFor="destination"
          >
            To
          </label>
          <select
            className="min-h-11 w-full rounded-[10px] border border-hairline bg-white px-3 text-base"
            id="destination"
            name="destination"
            onChange={(event) => changeDestination(event.target.value)}
            value={destination}
          >
            {places.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-muted">Atlanta time</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-muted"
            htmlFor="date"
          >
            Date
          </label>
          <input
            className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base"
            id="date"
            name="date"
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-muted"
            htmlFor="time"
          >
            Time
          </label>
          <input
            className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base"
            id="time"
            name="time"
            onChange={(event) => setTime(event.target.value)}
            required
            type="time"
            value={time}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-muted">Who can join</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              [
                initialAudience,
                initialAudience === "brothers"
                  ? "Brothers only"
                  : "Sisters only",
              ],
              ["anyone", "Anyone"],
            ] as const
          ).map(([value, label]) => (
            <label
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[10px] border text-sm font-medium ${
                audience === value
                  ? "border-primary bg-surface"
                  : "border-hairline"
              }`}
              key={value}
            >
              <input
                checked={audience === value}
                className="sr-only"
                name="audience"
                onChange={() => setAudience(value)}
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <span className="block text-sm font-medium text-muted">
          Seats, including you
        </span>
        <div className="flex items-center gap-4">
          <button
            aria-label="Decrease seats"
            className="size-11 rounded-[10px] border border-hairline text-xl"
            disabled={seats <= 2}
            onClick={() => setSeats((value) => Math.max(2, value - 1))}
            type="button"
          >
            −
          </button>
          <output className="min-w-6 text-center font-medium" htmlFor="seats">
            {seats}
          </output>
          <input id="seats" name="seats" type="hidden" value={seats} />
          <button
            aria-label="Increase seats"
            className="size-11 rounded-[10px] border border-hairline text-xl"
            disabled={seats >= 6}
            onClick={() => setSeats((value) => Math.min(6, value + 1))}
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted" htmlFor="notes">
          Notes
        </label>
        <textarea
          className="min-h-24 w-full resize-y rounded-[10px] border border-hairline px-3 py-2 text-base"
          id="notes"
          maxLength={280}
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Flight time, where to meet, luggage"
          value={notes}
        />
        <p className="text-right text-xs text-muted">{notes.length}/280</p>
      </div>

      {suggestions.length > 0 ? (
        <section aria-label="Similar rides" className="space-y-3">
          <h2 className="font-semibold">
            Already going around then — join instead?
          </h2>
          {suggestions.map((ride) => (
            <RideCard key={ride.id} ride={ride} />
          ))}
        </section>
      ) : isValidLocalTime && suggestionsLoading ? (
        <p className="text-sm text-muted" role="status">
          Checking for similar rides…
        </p>
      ) : null}

      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        className="min-h-11 w-full rounded-[10px] bg-primary px-4 font-medium text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Posting…" : "Post ride"}
      </button>
    </form>
  );
}
