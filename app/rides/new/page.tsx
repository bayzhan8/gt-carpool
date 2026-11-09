import { connection } from "next/server";
import { requireProfile } from "@/lib/auth";

export default async function NewRidePage() {
  await connection();
  await requireProfile("/rides/new");

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Post a ride</h1>
      <p className="mt-2 text-sm text-muted">
        Ride posting will be available soon.
      </p>
    </section>
  );
}
