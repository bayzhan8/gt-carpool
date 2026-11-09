"use client";

import Link from "next/link";
import { formatTime } from "@/lib/time";
import type { MyRide, RideCard as RideCardData } from "@/lib/rides";
import { audienceLabel, formatMix } from "@/lib/comfort";

export function RideCard({ ride }: { ride: RideCardData | MyRide }) {
  const isProfileCard = "status" in ride;
  const isFull = ride.seats_left === 0;
  const isGreyedOut = isFull && !isProfileCard;
  const rideStatus =
    isProfileCard && ride.status === "cancelled"
      ? "Cancelled"
      : isProfileCard && ride.is_past
        ? "Departed"
        : null;
  const mixLabel =
    ride.mix && ride.audience === "anyone" ? formatMix(ride.mix) : null;

  return (
    <Link
      className={`block rounded-[12px] border border-hairline p-4 ${
        isGreyedOut ? "bg-surface text-muted" : "hover:border-accent"
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
          {rideStatus ? (
            <span className="rounded-full bg-surface px-2 py-1">
              {rideStatus}
            </span>
          ) : (
            <>
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${isGreyedOut ? "bg-muted" : "bg-accent"}`}
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
      {isProfileCard ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-surface px-2 py-1">
            {ride.is_owner ? "Owner" : "Joined"}
          </span>
        </div>
      ) : ride.owner_name ? (
        <p className="mt-1 text-sm text-muted">{ride.owner_name}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-hairline px-2 py-1 text-xs">
          {audienceLabel(ride.audience)}
        </span>
        {mixLabel ? (
          <span className="text-xs text-muted">{mixLabel}</span>
        ) : null}
      </div>
    </Link>
  );
}
