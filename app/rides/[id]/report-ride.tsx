"use client";

import { useActionState, useRef, useState } from "react";
import { reportRideAction, type ReportActionState } from "./report-actions";

const initialState: ReportActionState = {};

const reasons = [
  ["no_show", "Didn't show up"],
  ["unsafe", "Felt unsafe"],
  ["wrong_info", "Wrong ride info"],
  ["other", "Something else"],
] as const;

export function ReportRide({ rideId }: { rideId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState("");
  const [state, action, pending] = useActionState(
    reportRideAction.bind(null, rideId),
    initialState,
  );

  return (
    <>
      <button
        className="text-sm text-muted underline underline-offset-4"
        onClick={() => dialog.current?.showModal()}
        type="button"
      >
        Report a problem
      </button>
      <dialog
        aria-labelledby="report-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[12px] p-6 backdrop:bg-black/40"
        ref={dialog}
      >
        <h2 className="text-lg font-semibold" id="report-title">
          Report a problem
        </h2>
        <form action={action} className="mt-4 space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">What happened?</legend>
            {reasons.map(([value, label]) => (
              <label className="flex min-h-11 items-center gap-3" key={value}>
                <input name="reason" required type="radio" value={value} />
                {label}
              </label>
            ))}
          </fieldset>
          <label
            className="block space-y-2 text-sm font-medium"
            htmlFor="report-details"
          >
            Details <span className="font-normal text-muted">(optional)</span>
            <textarea
              className="min-h-24 w-full resize-y rounded-[10px] border border-hairline px-3 py-2 text-base"
              id="report-details"
              maxLength={500}
              name="details"
              onChange={(event) => setDetails(event.target.value)}
              value={details}
            />
            <span
              aria-live="polite"
              className="block text-right text-xs text-muted"
            >
              {details.length}/500
            </span>
          </label>
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-muted" role="status">
              Thanks — we&apos;ll look into it.
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              className="min-h-11 flex-1 rounded-[10px] bg-primary px-4 font-medium text-white"
              disabled={pending}
              type="submit"
            >
              {pending ? "Sending…" : "Send"}
            </button>
            <button
              className="min-h-11 flex-1 rounded-[10px] border border-hairline px-4"
              formMethod="dialog"
              type="submit"
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
