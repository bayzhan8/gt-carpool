"use client";

import { useRef, useState } from "react";
import { deleteAccountAction } from "./actions";

export function DeleteAccountDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");

  return (
    <>
      <button
        className="min-h-11 text-sm font-medium text-red-700"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Delete account
      </button>
      <dialog
        aria-labelledby="delete-account-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[12px] border border-hairline p-6 shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <form action={deleteAccountAction} className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold" id="delete-account-title">
              Delete account
            </h2>
            <p className="text-sm text-muted">
              This removes you from your upcoming rides and deletes your
              profile. Type DELETE to confirm.
            </p>
          </div>
          <label className="block space-y-1 text-sm font-medium">
            Type DELETE to confirm
            <input
              autoComplete="off"
              className="min-h-11 w-full rounded-[10px] border border-hairline px-3"
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>
          <div className="flex justify-end gap-3">
            <button
              className="min-h-11 rounded-[10px] border border-hairline px-4"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <button
              className="min-h-11 rounded-[10px] bg-red-700 px-4 font-medium text-white disabled:opacity-50"
              disabled={confirmation !== "DELETE"}
              type="submit"
            >
              Delete
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
