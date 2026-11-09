"use client";

import Link from "next/link";
import { formatTime } from "@/lib/time";
import type { MyRide, RideCard as RideCardData } from "@/lib/rides";

export function RideCard({ ride }: { ride: RideCardData | MyRide }) {
  const isFull = ride.seats_left === 0;
  const isCancelled = "status" in ride && ride.status === "cancelled";

  return (
    <Link
      className={`block rounded-[12px] border border-hairline p-4 ${
        isFull ? "bg-surface text-muted" : "hover:border-accent"
      }`}
      href={`/rides/${ride.id}`}
    >
      <div className="flex items-center justify-between gap-4">
        <time
          className="tabular-nums text-2xl font-semibold tracking-tight"
          dateTime={ride.departs_at}
        >
          {formatTime(ride.departs_at)}
        </time>
        <span className="flex items-center gap-2 text-sm">
          {isCancelled ? (
            <span className="rounded-full bg-surface px-2 py-1">Cancelled</span>
          ) : (
            <>
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${
                  isFull ? "bg-muted" : "bg-accent"
                }`}
              />
              {isFull
                ? "Full"
                : `${ride.seats_left} seat${ride.seats_left === 1 ? "" : "s"} left`}
            </>
          )}
        </span>
      </div>
      <p className="mt-2 font-medium">
        {ride.origin.short_name} → {ride.destination.short_name}
      </p>
      {ride.owner_name ? (
        <p className="mt-1 text-sm text-muted">{ride.owner_name}</p>
      ) : null}
    </Link>
  );
}
