"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  cancelRideAction,
  joinRideAction,
  leaveRideAction,
  type RideActionState,
} from "./actions";

const initialState: RideActionState = {};

export function RideControls({
  rideId,
  isMember,
  isOwner,
  isFull,
}: {
  rideId: string;
  isMember: boolean;
  isOwner: boolean;
  isFull: boolean;
}) {
  const joinDialog = useRef<HTMLDialogElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const cancelDialog = useRef<HTMLDialogElement>(null);
  const [joinState, joinAction, joinPending] = useActionState(
    joinRideAction.bind(null, rideId),
    initialState,
  );
  const [leaveState, leaveAction, leavePending] = useActionState(
    leaveRideAction.bind(null, rideId),
    initialState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelRideAction.bind(null, rideId),
    initialState,
  );

  useEffect(() => {
    if (joinState.success) joinDialog.current?.close();
  }, [joinState.success]);
  useEffect(() => {
    if (leaveState.success) leaveDialog.current?.close();
  }, [leaveState.success]);
  useEffect(() => {
    if (cancelState.success) cancelDialog.current?.close();
  }, [cancelState.success]);

  return (
    <div className="space-y-4">
      {!isMember ? (
        isFull ? (
          <button
            className="min-h-11 w-full rounded-[10px] bg-surface px-4 font-medium text-muted"
            disabled
            type="button"
          >
            Full
          </button>
        ) : (
          <>
            <button
              className="min-h-11 w-full rounded-[10px] bg-primary px-4 font-medium text-white"
              onClick={() => joinDialog.current?.showModal()}
              type="button"
            >
              Join ride
            </button>
            <dialog
              className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[12px] p-6 backdrop:bg-black/40"
              ref={joinDialog}
            >
              <h2 className="text-lg font-semibold">Join this ride?</h2>
              <p className="mt-2 text-sm text-muted">
                You&apos;ll text each other and order one Uber/Lyft on the day.
              </p>
              {joinState.error ? (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {joinState.error}
                </p>
              ) : null}
              <form action={joinAction} className="mt-5 flex gap-3">
                <button
                  className="min-h-11 flex-1 rounded-[10px] bg-primary px-4 font-medium text-white"
                  disabled={joinPending}
                  type="submit"
                >
                  {joinPending ? "Joining…" : "Join"}
                </button>
                <button
                  className="min-h-11 flex-1 rounded-[10px] border border-hairline px-4"
                  formMethod="dialog"
                  type="submit"
                >
                  Not now
                </button>
              </form>
            </dialog>
          </>
        )
      ) : (
        <>
          {isOwner ? (
            <div className="flex gap-3">
              <a
                className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-hairline px-4 font-medium"
                href={`/rides/${rideId}/edit`}
              >
                Edit
              </a>
              <button
                className="min-h-11 flex-1 rounded-[10px] border border-hairline px-4 font-medium"
                onClick={() => cancelDialog.current?.showModal()}
                type="button"
              >
                Cancel ride
              </button>
            </div>
          ) : null}
          <button
            className="min-h-11 w-full rounded-[10px] border border-hairline px-4 font-medium"
            onClick={() => leaveDialog.current?.showModal()}
            type="button"
          >
            Leave ride
          </button>
          <dialog
            className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[12px] p-6 backdrop:bg-black/40"
            ref={leaveDialog}
          >
            <h2 className="text-lg font-semibold">Leave this ride?</h2>
            {leaveState.error ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {leaveState.error}
              </p>
            ) : null}
            <form action={leaveAction} className="mt-5 flex gap-3">
              <button
                className="min-h-11 flex-1 rounded-[10px] bg-primary px-4 font-medium text-white"
                disabled={leavePending}
                type="submit"
              >
                {leavePending ? "Leaving…" : "Leave"}
              </button>
              <button
                className="min-h-11 flex-1 rounded-[10px] border border-hairline px-4"
                formMethod="dialog"
                type="submit"
              >
                Not now
              </button>
            </form>
          </dialog>
          {isOwner ? (
            <dialog
              className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[12px] p-6 backdrop:bg-black/40"
              ref={cancelDialog}
            >
              <h2 className="text-lg font-semibold">Cancel this ride?</h2>
              <p className="mt-2 text-sm text-muted">
                This ride will be marked as cancelled for its members.
              </p>
              {cancelState.error ? (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {cancelState.error}
                </p>
              ) : null}
              <form action={cancelAction} className="mt-5 flex gap-3">
                <button
                  className="min-h-11 flex-1 rounded-[10px] bg-primary px-4 font-medium text-white"
                  disabled={cancelPending}
                  type="submit"
                >
                  {cancelPending ? "Cancelling…" : "Cancel ride"}
                </button>
                <button
                  className="min-h-11 flex-1 rounded-[10px] border border-hairline px-4"
                  formMethod="dialog"
                  type="submit"
                >
                  Not now
                </button>
              </form>
            </dialog>
          ) : null}
        </>
      )}
    </div>
  );
}
