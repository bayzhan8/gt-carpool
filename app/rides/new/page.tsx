import { connection } from "next/server";
import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { validDay } from "@/lib/ride-filters";
import { atlantaLocalToInstant, atlantaParts, nextDays } from "@/lib/time";
import { RideForm } from "./ride-form";

export const metadata: Metadata = {
  title: "Post a ride",
};

type NewRidePageProps = {
  searchParams: Promise<{
    date?: string | string[];
    dir?: string | string[];
  }>;
};

export default async function NewRidePage({ searchParams }: NewRidePageProps) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const days = nextDays(121, now);
  const current = atlantaParts(now.toISOString());
  let targetHour = Number(current.time.slice(0, 2)) + 2;
  let targetDate = days[0] ?? "";
  let targetTime = "";

  while (targetHour < 48) {
    const dayOffset = Math.floor(targetHour / 24);
    targetDate = days[dayOffset] ?? "";
    targetTime = `${String(targetHour % 24).padStart(2, "0")}:00`;
    if (targetDate && atlantaLocalToInstant(targetDate, targetTime).ok) {
      break;
    }
    targetHour += 1;
  }
  const requestedDate =
    typeof params.date === "string" ? validDay(params.date) : null;
  const requestedDateIsAllowed =
    requestedDate !== null &&
    requestedDate >= (days[0] ?? "") &&
    requestedDate <= (days[120] ?? "");
  const requestedTime = "09:00";
  const requestedInstant =
    requestedDateIsAllowed && requestedDate
      ? atlantaLocalToInstant(requestedDate, requestedTime)
      : null;
  const requestedTimeIsSoon =
    requestedInstant?.ok === true &&
    new Date(requestedInstant.iso).getTime() - now.getTime() < 15 * 60 * 1000;
  const initialDate =
    requestedDateIsAllowed && requestedDate && !requestedTimeIsSoon
      ? requestedDate
      : targetDate;
  const initialTime =
    requestedDateIsAllowed && !requestedTimeIsSoon ? requestedTime : targetTime;
  const direction = params.dir === "campus" ? "campus" : "airport";
  const nextParams = new URLSearchParams();
  if (params.dir === "airport" || params.dir === "campus") {
    nextParams.set("dir", direction);
  }
  if (requestedDateIsAllowed && requestedDate) {
    nextParams.set("date", requestedDate);
  }
  const next = nextParams.size
    ? `/rides/new?${nextParams.toString()}`
    : "/rides/new";
  const { profile } = await requireProfile(next);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Post a ride</h1>
      <p className="mt-2 text-sm text-muted">
        Share your trip with other Georgia Tech students.
      </p>
      {targetDate ? (
        <RideForm
          initialDate={initialDate}
          initialTime={initialTime}
          initialOrigin={direction === "campus" ? "atl-domestic" : "gt"}
          initialDestination={direction === "campus" ? "gt" : "atl-domestic"}
          maxDate={days[120] ?? ""}
          ownerGender={profile.gender}
        />
      ) : null}
    </section>
  );
}
