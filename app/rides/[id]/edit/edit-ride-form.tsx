"use client";

import { useActionState, useState } from "react";
import { updateRideAction, type EditRideState } from "./actions";
import type { RideAudience } from "@/lib/rides";

const initialState: EditRideState = {};

export function EditRideForm({
  rideId,
  date,
  time,
  audience: initialAudience,
  ownerGender,
  seats: initialSeats,
  notes: initialNotes,
}: {
  rideId: string;
  date: string;
  time: string;
  audience: RideAudience;
  ownerGender: "brother" | "sister";
  seats: number;
  notes: string;
}) {
  const [state, action, pending] = useActionState(
    updateRideAction.bind(null, rideId),
    initialState,
  );
  const [seats, setSeats] = useState(initialSeats);
  const [notes, setNotes] = useState(initialNotes);
  const [audience, setAudience] = useState<RideAudience>(initialAudience);
  const ownAudience = ownerGender === "brother" ? "brothers" : "sisters";

  return (
    <form action={action} className="space-y-5">
      <p className="text-sm text-muted">Atlanta time</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-muted">Who can join</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              [
                ownAudience,
                ownerGender === "brother" ? "Brothers only" : "Sisters only",
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
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2 text-sm font-medium text-muted">
          Date
          <input
            className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base text-text"
            defaultValue={date}
            name="date"
            required
            type="date"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-muted">
          Time
          <input
            className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base text-text"
            defaultValue={time}
            name="time"
            required
            type="time"
          />
        </label>
      </div>
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
          <output className="min-w-6 text-center font-medium">{seats}</output>
          <input name="seats" type="hidden" value={seats} />
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
      <label className="block space-y-2 text-sm font-medium text-muted">
        Notes
        <textarea
          className="min-h-24 w-full rounded-[10px] border border-hairline px-3 py-2 text-base text-text"
          maxLength={280}
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
        <span className="block text-right text-xs">{notes.length}/280</span>
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        className="min-h-11 w-full rounded-[10px] bg-primary px-4 font-medium text-white"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
