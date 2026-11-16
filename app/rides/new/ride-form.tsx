"use client";

import { useActionState, useEffect, useState } from "react";
import { atlantaLocalToInstant } from "@/lib/time";
import type {
  OpenPlace,
  RideAudience,
  RideCard as RideCardData,
} from "@/lib/rides";
import { AudienceChoice } from "../audience-choice";
import { AddPlaceSheet } from "../add-place-sheet";
import { TimePicker } from "../time-picker";
import { RideCard } from "../ride-card";
import {
  createRideAction,
  findSimilarRidesAction,
  type CreateRideState,
} from "./actions";

const curatedPlaces = [
  { slug: "gt", name: "Campus", kind: "campus" },
  { slug: "atl-domestic", name: "ATL Domestic", kind: "airport" },
  { slug: "atl-intl", name: "ATL International", kind: "airport" },
] as const;
const addPlaceOption = "__add-place__";

type PlaceOption = {
  slug: string;
  name: string;
  kind: "campus" | "airport" | "other";
};

const initialState: CreateRideState = {};

type RideFormProps = {
  initialDate: string;
  initialTime: string;
  initialOrigin?: string;
  initialDestination?: string;
  maxDate: string;
  ownerGender: "man" | "woman" | "unspecified" | null;
  openPlaces: OpenPlace[];
  openSheetOnLoad: boolean;
};

export function RideForm({
  initialDate,
  initialTime,
  initialOrigin = "gt",
  initialDestination = "atl-domestic",
  maxDate,
  ownerGender,
  openPlaces,
  openSheetOnLoad,
}: RideFormProps) {
  const [state, action, pending] = useActionState(
    createRideAction,
    initialState,
  );
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [seats, setSeats] = useState(4);
  const [notes, setNotes] = useState("");
  const [audience, setAudience] = useState<RideAudience>("anyone");
  const [addedPlaces, setAddedPlaces] = useState<PlaceOption[]>([]);
  const [sheetSide, setSheetSide] = useState<"origin" | "destination" | null>(
    openSheetOnLoad ? "destination" : null,
  );
  const [suggestionState, setSuggestionState] = useState<{
    key: string;
    rides: RideCardData[];
  }>({ key: "", rides: [] });
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const requestKey = `${origin}|${destination}|${date}|${time}`;
  const isValidLocalTime = atlantaLocalToInstant(date, time).ok;
  const suggestions =
    suggestionState.key === requestKey ? suggestionState.rides : [];
  const placeOptions: PlaceOption[] = [
    ...curatedPlaces,
    ...openPlaces.slice(0, 8).map((place) => ({
      slug: place.slug,
      name: place.name,
      kind: "other" as const,
    })),
    ...addedPlaces,
  ].filter(
    (place, index, places) =>
      places.findIndex((candidate) => candidate.slug === place.slug) === index,
  );

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
    if (value === addPlaceOption) {
      setSheetSide("origin");
      return;
    }
    setOrigin(value);
    const selected = placeOptions.find((place) => place.slug === value);
    if (selected && selected.kind !== "campus") {
      setDestination("gt");
    } else if (destination === "gt") {
      setDestination("atl-domestic");
    }
  }

  function changeDestination(value: string) {
    if (value === addPlaceOption) {
      setSheetSide("destination");
      return;
    }
    setDestination(value);
    const selected = placeOptions.find((place) => place.slug === value);
    if (selected && selected.kind !== "campus") {
      setOrigin("gt");
    } else if (origin === "gt") {
      setOrigin("atl-domestic");
    }
  }

  function selectAddedPlace(place: Pick<OpenPlace, "slug" | "name">) {
    const option: PlaceOption = { ...place, kind: "other" };
    setAddedPlaces((current) => [
      ...current.filter((candidate) => candidate.slug !== option.slug),
      option,
    ]);
    if (sheetSide === "origin") {
      setOrigin(option.slug);
      setDestination("gt");
    } else {
      setDestination(option.slug);
      setOrigin("gt");
    }
    setSheetSide(null);
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="grid grid-cols-[1fr_auto] items-end gap-x-2 gap-y-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="col-start-1 row-start-1 space-y-2">
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
            {curatedPlaces.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.name}
              </option>
            ))}
            {openPlaces.length > 0 || addedPlaces.length > 0 ? (
              <optgroup label="Other places">
                {placeOptions
                  .filter((place) => place.kind === "other")
                  .map((place) => (
                    <option key={place.slug} value={place.slug}>
                      {place.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <option value={addPlaceOption}>Somewhere else…</option>
          </select>
        </div>
        <button
          aria-label="Swap route"
          className="col-start-2 row-span-2 row-start-1 mb-0.5 flex size-11 items-center justify-center self-center rounded-full border border-hairline sm:row-span-1 sm:self-end"
          onClick={(event) => {
            event.preventDefault();
            setOrigin(destination);
            setDestination(origin);
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            className="inline-block rotate-90 sm:rotate-0"
          >
            ⇄
          </span>
        </button>
        <div className="col-start-1 row-start-2 space-y-2 sm:col-start-3 sm:row-start-1">
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
            {curatedPlaces.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.name}
              </option>
            ))}
            {openPlaces.length > 0 || addedPlaces.length > 0 ? (
              <optgroup label="Other places">
                {placeOptions
                  .filter((place) => place.kind === "other")
                  .map((place) => (
                    <option key={place.slug} value={place.slug}>
                      {place.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            <option value={addPlaceOption}>Somewhere else…</option>
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
            max={maxDate}
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
          <TimePicker id="time" name="time" onChange={setTime} value={time} />
        </div>
      </div>

      <AudienceChoice
        onChange={setAudience}
        ownerGender={ownerGender}
        value={audience}
      />
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
      <AddPlaceSheet
        onClose={() => setSheetSide(null)}
        onSelect={selectAddedPlace}
        open={sheetSide !== null}
        openPlaces={openPlaces}
        side={sheetSide ?? "destination"}
      />
    </form>
  );
}
