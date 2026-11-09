import { connection } from "next/server";
import { requireProfile } from "@/lib/auth";
import { atlantaLocalToInstant, atlantaParts, next14Days } from "@/lib/time";
import { RideForm } from "./ride-form";

export default async function NewRidePage() {
  await connection();
  const { profile } = await requireProfile("/rides/new");
  const now = new Date();
  const days = next14Days(now);
  const current = atlantaParts(now.toISOString());
  let targetHour = Number(current.time.slice(0, 2)) + 2;
  let targetDate = days[0];
  let targetTime = "";

  while (targetHour < 48) {
    const dayOffset = Math.floor(targetHour / 24);
    targetDate = days[dayOffset];
    targetTime = `${String(targetHour % 24).padStart(2, "0")}:00`;
    if (targetDate && atlantaLocalToInstant(targetDate, targetTime).ok) {
      break;
    }
    targetHour += 1;
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Post a ride</h1>
      <p className="mt-2 text-sm text-muted">
        Share your trip with other Georgia Tech students.
      </p>
      {targetDate ? (
        <RideForm
          initialAudience={
            profile.gender === "brother" ? "brothers" : "sisters"
          }
          initialDate={targetDate}
          initialTime={targetTime}
        />
      ) : null}
    </section>
  );
}
