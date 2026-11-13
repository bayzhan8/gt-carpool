"use client";

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minutes = Array.from({ length: 12 }, (_, index) => index * 5);
const periods = ["AM", "PM"] as const;
type Period = (typeof periods)[number];

const quickPicks = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];

type Parts = { hour: number; minute: number; period: Period };

function toParts(value: string): Parts {
  const [rawHour = 12, rawMinute = 0] = value.split(":").map(Number);
  const hour24 = Number.isFinite(rawHour) ? rawHour : 12;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  return {
    hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute: Math.min(55, Math.round(minute / 5) * 5),
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function toValue({ hour, minute, period }: Parts): string {
  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatClock(value: string): string {
  const [rawHour = 0, rawMinute = 0] = value.split(":").map(Number);
  const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return `${hour}:${String(rawMinute).padStart(2, "0")} ${rawHour >= 12 ? "PM" : "AM"}`;
}

function Wheel<T extends number | string>({
  label,
  items,
  selected,
  onSelect,
  format,
}: {
  label: string;
  items: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  format: (value: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const index = Math.max(0, items.indexOf(selected));

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_HEIGHT;
    // Only position the wheel on mount; later changes scroll smoothly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const target = index * ITEM_HEIGHT;
    if (Math.abs(element.scrollTop - target) > 2) {
      element.scrollTo({ top: target, behavior: "smooth" });
    }
  }, [index]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function handleScroll() {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const element = ref.current;
      if (!element) return;
      const nearest = Math.round(element.scrollTop / ITEM_HEIGHT);
      const item = items[Math.min(items.length - 1, Math.max(0, nearest))];
      if (item !== undefined) onSelect(item);
    }, 90);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const item = items[(index + step + items.length) % items.length];
    if (item !== undefined) onSelect(item);
  }

  return (
    <div
      aria-activedescendant={`${label}-${String(selected)}`}
      aria-label={label}
      className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[10px] [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-scrollbar]:hidden"
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      ref={ref}
      role="listbox"
      style={{
        paddingBlock: ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT,
      }}
      tabIndex={0}
    >
      {items.map((item) => {
        const isSelected = item === selected;
        return (
          <div
            aria-selected={isSelected}
            className={`flex cursor-pointer snap-center items-center justify-center text-xl tabular-nums transition-colors ${
              isSelected ? "font-semibold text-text" : "text-muted"
            }`}
            id={`${label}-${String(item)}`}
            key={String(item)}
            onClick={() => onSelect(item)}
            role="option"
            style={{ height: ITEM_HEIGHT }}
          >
            {format(item)}
          </div>
        );
      })}
    </div>
  );
}

export function TimePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
}: {
  id: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue ?? value ?? "12:00");
  const current = value ?? internal;
  const parts = toParts(current);
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  }, [current]);

  function update(next: string) {
    latest.current = next;
    setInternal(next);
    onChange?.(next);
  }

  function setPart(patch: Partial<Parts>) {
    const next = toValue({ ...toParts(latest.current), ...patch });
    if (next !== latest.current) update(next);
  }

  function openPicker() {
    setOpen(true);
    dialogRef.current?.showModal();
  }

  function closePicker() {
    dialogRef.current?.close();
  }

  return (
    <>
      <input name={name} type="hidden" value={current} />
      <button
        aria-haspopup="dialog"
        className="flex min-h-11 w-full items-center justify-between rounded-[10px] border border-hairline px-3 text-left text-base text-text tabular-nums focus-visible:border-accent"
        id={id}
        onClick={openPicker}
        type="button"
      >
        {formatClock(current)}
        <svg
          aria-hidden="true"
          className="size-4 text-muted"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      <dialog
        aria-labelledby={`${id}-title`}
        className="mx-auto mt-auto mb-0 w-full max-w-md rounded-t-[20px] p-0 shadow-xl transition-transform duration-200 backdrop:bg-black/30 starting:open:translate-y-full sm:m-auto sm:rounded-[16px] sm:starting:open:translate-y-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) closePicker();
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <div className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto h-1 w-10 rounded-full bg-hairline sm:hidden" />
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold" id={`${id}-title`}>
              Departure time
            </h2>
            <p
              aria-live="polite"
              className="text-2xl font-semibold tracking-tight tabular-nums"
            >
              {formatClock(current)}
            </p>
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickPicks.map((pick) => (
              <button
                aria-pressed={current === pick}
                className={`min-h-10 shrink-0 rounded-full border px-3 text-sm tabular-nums ${
                  current === pick
                    ? "border-primary bg-primary text-white"
                    : "border-hairline"
                }`}
                key={pick}
                onClick={() => update(pick)}
                type="button"
              >
                {formatClock(pick)}
              </button>
            ))}
          </div>
          {open ? (
            <div
              className="relative grid grid-cols-3 gap-2 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
              style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 rounded-[10px] bg-surface"
                style={{
                  top: ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT,
                  height: ITEM_HEIGHT,
                }}
              />
              <Wheel
                format={(hour) => String(hour)}
                items={hours}
                label="Hour"
                onSelect={(hour) => setPart({ hour })}
                selected={parts.hour}
              />
              <Wheel
                format={(minute) => String(minute).padStart(2, "0")}
                items={minutes}
                label="Minute"
                onSelect={(minute) => setPart({ minute })}
                selected={parts.minute}
              />
              <Wheel
                format={(period) => period}
                items={periods}
                label="AM or PM"
                onSelect={(period) => setPart({ period })}
                selected={parts.period}
              />
            </div>
          ) : null}
          <button
            className="min-h-12 w-full rounded-[10px] bg-primary font-medium text-white"
            onClick={closePicker}
            type="button"
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
