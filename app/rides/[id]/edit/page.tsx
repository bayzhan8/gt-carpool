import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getRide } from "@/lib/rides";
import { atlantaParts } from "@/lib/time";
import { EditRideForm } from "./edit-ride-form";

type EditRidePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRidePage({ params }: EditRidePageProps) {
  await connection();
  const { id } = await params;
  const { profile } = await requireProfile(`/rides/${id}/edit`);
  const ride = await getRide(id);

  if (
    !ride ||
    !ride.viewer_is_owner ||
    ride.is_past ||
    ride.status !== "active"
  ) {
    notFound();
  }

  const local = atlantaParts(ride.departs_at);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit ride</h1>
      <p className="text-sm text-muted">
        {ride.origin.short_name} → {ride.destination.short_name}
      </p>
      <EditRideForm
        audience={ride.audience}
        ownerGender={profile.gender}
        date={local.date}
        notes={ride.notes ?? ""}
        rideId={ride.id}
        seats={ride.seats}
        time={local.time}
      />
    </section>
  );
}
