"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { setGenderAction, type GenderActionState } from "./gender-actions";

const choices = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["unspecified", "Prefer not to say"],
] as const;

const initialState: GenderActionState = {};
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function GenderSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (gender: "man" | "woman" | "unspecified") => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const onSavedRef = useRef(onSaved);
  const [selected, setSelected] = useState<string | null>(null);
  const portalReady = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [state, action, pending] = useActionState(
    setGenderAction,
    initialState,
  );

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    if (!portalReady) return;
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setSelected(null);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, portalReady]);

  useEffect(() => {
    if (state.gender) onSavedRef.current(state.gender);
  }, [state.gender]);

  if (!portalReady) return null;

  return createPortal(
    <dialog
      aria-labelledby="gender-sheet-title"
      className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-[20px] p-0 shadow-xl backdrop:bg-black/30 sm:m-auto sm:rounded-[16px]"
      onCancel={(event) => {
        event.preventDefault();
        dialog.current?.close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      ref={dialog}
    >
      <div className="space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto h-1 w-10 rounded-full bg-hairline sm:hidden" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold" id="gender-sheet-title">
            Women-only and men-only rides
          </h2>
          <p className="text-sm text-muted">
            To post or join one, tell us which fits you.
          </p>
        </div>
        <form action={action} className="space-y-4">
          <fieldset className="grid gap-2">
            <legend className="sr-only">Gender</legend>
            {choices.map(([value, label], index) => (
              <label
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border border-hairline px-4 font-medium has-[:checked]:border-primary has-[:checked]:bg-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                key={value}
              >
                <input
                  autoFocus={index === 0}
                  checked={selected === value}
                  className="size-5 accent-primary"
                  name="gender"
                  onChange={() => setSelected(value)}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-muted">
            Only used to match you with women-only or men-only rides. Never
            shown on your profile or to other riders.
          </p>
          {state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              className="min-h-12 flex-1 rounded-[10px] bg-primary px-4 font-medium text-white disabled:opacity-60"
              disabled={!selected || pending}
              type="submit"
            >
              {pending ? "Saving…" : "Continue"}
            </button>
            <button
              className="min-h-12 flex-1 rounded-[10px] border border-hairline px-4"
              onClick={() => dialog.current?.close()}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </dialog>,
    document.body,
  );
}
