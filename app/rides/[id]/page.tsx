import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getViewer } from "@/lib/auth";
import { getRide, type RideContact, type RideMemberSummary } from "@/lib/rides";
import { formatLongDate, formatTime } from "@/lib/time";
import { audienceLabel, formatMix } from "@/lib/comfort";
import { RideContacts } from "./ride-contacts";
import { RideControls } from "./ride-controls";
import { ShareRide } from "./share-ride";
import { ReportRide } from "./report-ride";

type RidePageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  robots: { index: false },
};

export default async function RidePage({ params }: RidePageProps) {
  await connection();
  const { id } = await params;
  const ride = await getRide(id);

  if (!ride) notFound();

  const { user, profile } = await getViewer();
  const isMember = ride.viewer_is_member === true;
  const isOwner = ride.viewer_is_owner === true;
  const summaryMembers = (ride.members ?? []) as RideMemberSummary[];
  const contactMembers = isMember ? (ride.members as RideContact[]) : undefined;
  const readOnly = ride.is_past || ride.status === "cancelled";
  const mixLabel =
    ride.mix && ride.audience === "anyone" ? formatMix(ride.mix) : null;

  return (
    <section className="space-y-7">
      {ride.status === "cancelled" ? (
        <p className="rounded-[10px] bg-surface px-4 py-3 font-medium">
          Cancelled
        </p>
      ) : ride.is_past ? (
        <p className="rounded-[10px] bg-surface px-4 py-3 font-medium">
          This ride has departed
        </p>
      ) : null}
      <div>
        <time
          className="tabular-nums text-4xl font-semibold tracking-tight"
          dateTime={ride.departs_at}
        >
          {formatTime(ride.departs_at)}
        </time>
        <p className="mt-2 text-muted">{formatLongDate(ride.departs_at)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-hairline px-3 py-1 text-sm">
          {audienceLabel(ride.audience)}
        </span>
        {mixLabel ? (
          <span className="text-sm text-muted">{mixLabel}</span>
        ) : null}
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <a
            className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-4 text-sm font-medium"
            href={`/rides/${ride.id}/calendar.ics`}
          >
            Add to calendar
          </a>
          <ShareRide
            title={`Carpool: ${ride.origin.short_name} → ${ride.destination.short_name}`}
          />
        </div>
      ) : null}
      <div className="rounded-[12px] border border-hairline p-4">
        <h1 className="text-xl font-semibold">
          {ride.origin.name} → {ride.destination.name}
        </h1>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-xs font-medium text-muted">From</dt>
            <dd className="mt-1 font-medium">{ride.origin.name}</dd>
            <dd className="mt-1 text-sm text-muted">{ride.origin.address}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">To</dt>
            <dd className="mt-1 font-medium">{ride.destination.name}</dd>
            <dd className="mt-1 text-sm text-muted">
              {ride.destination.address}
            </dd>
          </div>
        </dl>
      </div>
      <div>
        <p className="font-medium">
          {ride.seats_left} of {ride.seats} seats left
        </p>
        {isMember && contactMembers ? (
          <p className="mt-1 text-sm text-muted">
            Split {contactMembers.length} ways
          </p>
        ) : null}
      </div>
      {ride.notes ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{ride.notes}</p>
        </section>
      ) : null}
      {user && summaryMembers.length > 0 ? (
        isMember && contactMembers ? (
          <RideContacts
            departsAt={ride.departs_at}
            members={contactMembers}
            rideUrl={`${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/rides/${ride.id}`}
            route={`${ride.origin.short_name} → ${ride.destination.short_name}`}
          />
        ) : (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Passengers</h2>
            <ul className="space-y-2">
              {summaryMembers.map((member, index) => (
                <li
                  className="flex items-center gap-2"
                  key={`${member.name}-${index}`}
                >
                  {member.name}
                  {member.is_owner ? (
                    <span className="rounded-full bg-surface px-2 py-1 text-xs">
                      Owner
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      ) : null}
      {!user && !readOnly ? (
        <Link
          className="block min-h-11 rounded-[10px] bg-primary px-4 py-3 text-center font-medium text-white"
          href={`/signin?next=${encodeURIComponent(`/rides/${id}`)}`}
        >
          Sign in with your GT email to join
        </Link>
      ) : user &&
        !isMember &&
        !readOnly &&
        ride.audience !== "anyone" &&
        ride.viewer_can_join_audience === false ? (
        <p className="rounded-[10px] border border-hairline px-4 py-3 text-sm text-muted">
          This ride is for {ride.audience === "women" ? "women" : "men"} only.
        </p>
      ) : user && !readOnly ? (
        <RideControls
          isFull={ride.seats_left === 0}
          isMember={isMember}
          isOwner={isOwner}
          rideId={ride.id}
        />
      ) : null}
      {user && profile?.gender ? <ReportRide rideId={ride.id} /> : null}
    </section>
  );
}
