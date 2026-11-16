"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { placeKey } from "@/lib/place-key";
import type { OpenPlace } from "@/lib/rides";
import { addPlaceAction, type AddPlaceState } from "./new/actions";

const initialState: AddPlaceState = {};
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AddPlaceSheet({
  open,
  side,
  openPlaces,
  onClose,
  onSelect,
}: {
  open: boolean;
  side: "origin" | "destination";
  openPlaces: OpenPlace[];
  onClose: () => void;
  onSelect: (place: Pick<OpenPlace, "slug" | "name">) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onSelect);
  const [name, setName] = useState("");
  const [attempted, setAttempted] = useState(false);
  const portalReady = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [state, action, pending] = useActionState(addPlaceAction, initialState);
  const queryKey = placeKey(name);
  const suggestions = queryKey
    ? openPlaces.filter((place) => placeKey(place.name).includes(queryKey))
    : [];

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!portalReady) return;
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setName("");
      setAttempted(false);
      element.showModal();
      window.setTimeout(() => input.current?.focus(), 0);
    } else if (!open && element.open) {
      element.close();
    }
  }, [open, portalReady]);

  useEffect(() => {
    if (state.place) {
      onSelectRef.current(state.place);
      dialog.current?.close();
    }
  }, [state.place]);

  function closeSheet() {
    dialog.current?.close();
    onClose();
  }

  if (!portalReady) return null;

  return createPortal(
    <dialog
      aria-labelledby="add-place-title"
      className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-[20px] p-0 shadow-xl backdrop:bg-black/30 sm:m-auto sm:rounded-[16px]"
      onCancel={(event) => {
        event.preventDefault();
        closeSheet();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeSheet();
      }}
      ref={dialog}
    >
      <div className="space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto h-1 w-10 rounded-full bg-hairline sm:hidden" />
        <div className="space-y-2">
          <h2 className="text-lg font-semibold" id="add-place-title">
            {side === "destination"
              ? "Where are you headed?"
              : "Where are you coming from?"}
          </h2>
        </div>
        <form
          action={action}
          className="space-y-4"
          onSubmit={() => setAttempted(true)}
        >
          <label
            className="block space-y-2 text-sm font-medium"
            htmlFor="place-name"
          >
            <span>Place</span>
            <input
              autoComplete="off"
              className="min-h-11 w-full rounded-[10px] border border-hairline px-3 text-base"
              id="place-name"
              maxLength={32}
              name="name"
              onChange={(event) => {
                setName(event.target.value);
                setAttempted(false);
              }}
              placeholder="Athens, Savannah, State Farm Arena…"
              ref={input}
              value={name}
            />
          </label>
          {suggestions.length > 0 ? (
            <div
              aria-label="Matching places"
              className="space-y-2"
              role="group"
            >
              {suggestions.map((place) => (
                <button
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-hairline px-3 text-left text-sm"
                  key={place.slug}
                  onClick={() => onSelectRef.current(place)}
                  type="button"
                >
                  <span className="min-w-0 truncate">{place.name}</span>
                  <span className="shrink-0 whitespace-nowrap text-muted">
                    · {place.upcoming} upcoming ride
                    {place.upcoming === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-sm text-muted">
            Use a city or venue, not a home address. Places with no rides for 30
            days drop off this list.
          </p>
          {attempted && state.error ? (
            <p className="text-sm text-red-700" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              className="min-h-11 flex-1 rounded-[10px] bg-primary px-4 font-medium text-white disabled:opacity-60"
              disabled={!name.trim() || pending}
              type="submit"
            >
              {pending ? "Saving…" : "Use this place"}
            </button>
            <button
              className="min-h-11 flex-1 rounded-[10px] border border-hairline px-4"
              onClick={closeSheet}
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
