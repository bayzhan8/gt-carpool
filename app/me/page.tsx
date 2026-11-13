import { connection } from "next/server";
import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { myRides } from "@/lib/rides";
import { RideCard } from "@/app/rides/ride-card";
import { AccountTabs } from "@/app/account-tabs";

export const metadata: Metadata = {
  title: "My rides",
};

export default async function MePage() {
  await connection();
  await requireProfile("/me");
  const rides = await myRides();
  const upcoming = rides
    .filter((ride) => !ride.is_past && ride.status === "active")
    .sort(
      (left, right) =>
        new Date(left.departs_at).getTime() -
        new Date(right.departs_at).getTime(),
    );
  const past = rides
    .filter((ride) => ride.is_past || ride.status !== "active")
    .sort(
      (left, right) =>
        new Date(right.departs_at).getTime() -
        new Date(left.departs_at).getTime(),
    );
  return (
    <section className="space-y-6">
      <AccountTabs active="me" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My rides</h1>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length ? (
          upcoming.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p className="text-sm text-muted">No upcoming rides.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Past &amp; cancelled</h2>
        {past.length ? (
          past.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p className="text-sm text-muted">No past rides.</p>
        )}
      </section>
    </section>
  );
}
