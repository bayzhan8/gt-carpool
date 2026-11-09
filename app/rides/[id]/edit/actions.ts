"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireProfile } from "@/lib/auth";
import { errorCopy } from "@/lib/errors";
import { drainOutbox } from "@/lib/notifications/drain";
import { atlantaLocalToInstant } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

export type EditRideState = {
  error?: string;
};

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function updateRideAction(
  rideId: string,
  _previousState: EditRideState,
  formData: FormData,
): Promise<EditRideState> {
  await requireProfile(`/rides/${rideId}/edit`);

  const localTime = atlantaLocalToInstant(
    fieldValue(formData, "date"),
    fieldValue(formData, "time"),
  );
  const seats = Number(fieldValue(formData, "seats"));
  const notes = fieldValue(formData, "notes");

  if (!localTime.ok) {
    return {
      error:
        localTime.reason === "nonexistent"
          ? "That time doesn't exist in Atlanta (clocks spring forward)."
          : errorCopy("invalid_time"),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_ride", {
    p_ride_id: rideId,
    p_departs_at: localTime.iso,
    p_seats: seats,
    p_notes: notes,
    p_audience: fieldValue(formData, "audience") || "anyone",
  });

  if (error) {
    return { error: errorCopy(error.message) };
  }

  after(async () => {
    await drainOutbox();
  });
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath(`/rides/${rideId}`);
  redirect(`/rides/${rideId}`);
}
