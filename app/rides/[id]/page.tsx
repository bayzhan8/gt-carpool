import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getViewer } from "@/lib/auth";
import { getRide, type RideContact, type RideMemberSummary } from "@/lib/rides";
import { formatLongDate, formatTime } from "@/lib/time";
import { RideContacts } from "./ride-contacts";
import { RideControls } from "./ride-controls";

type RidePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RidePage({ params }: RidePageProps) {
  await connection();
  const { id } = await params;
  const [ride, { user }] = await Promise.all([getRide(id), getViewer()]);

  if (!ride) notFound();

  const isMember = ride.viewer_is_member === true;
  const isOwner = ride.viewer_is_owner === true;
  const summaryMembers = (ride.members ?? []) as RideMemberSummary[];
  const contactMembers = isMember ? (ride.members as RideContact[]) : undefined;
  const readOnly = ride.is_past || ride.status === "cancelled";

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
      <div className="rounded-[12px] border border-hairline p-4">
        <h1 className="text-xl font-semibold">
          {ride.origin.name} → {ride.destination.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {ride.origin.address} → {ride.destination.address}
        </p>
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
      {ride.notes !== undefined ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{ride.notes}</p>
        </section>
      ) : null}
      {user && summaryMembers.length > 0 ? (
        isMember && contactMembers ? (
          <RideContacts members={contactMembers} />
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
      ) : user && !readOnly ? (
        <RideControls
          isFull={ride.seats_left === 0}
          isMember={isMember}
          isOwner={isOwner}
          rideId={ride.id}
        />
      ) : null}
    </section>
  );
}
