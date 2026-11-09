import { connection } from "next/server";
import { requireProfile } from "@/lib/auth";

type EditRidePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRidePage({ params }: EditRidePageProps) {
  await connection();
  const { id } = await params;
  await requireProfile(`/rides/${id}/edit`);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Edit ride</h1>
      <p className="mt-2 text-sm text-muted">
        Ride editing will be available soon.
      </p>
    </section>
  );
}
