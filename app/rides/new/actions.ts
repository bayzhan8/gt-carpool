"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { errorCopy } from "@/lib/errors";
import { atlantaLocalToInstant } from "@/lib/time";
import { findSimilarRides } from "@/lib/rides";
import type { RideCard } from "@/lib/rides";
import { createClient } from "@/lib/supabase/server";

export type CreateRideState = {
  error?: string;
};

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function findSimilarRidesAction(
  origin: string,
  destination: string,
  date: string,
  time: string,
): Promise<RideCard[]> {
  await requireProfile("/rides/new");
  const localTime = atlantaLocalToInstant(date, time);

  if (!localTime.ok) {
    return [];
  }

  return findSimilarRides(origin, destination, localTime.iso);
}

export async function createRideAction(
  _previousState: CreateRideState,
  formData: FormData,
): Promise<CreateRideState> {
  await requireProfile("/rides/new");

  const origin = fieldValue(formData, "origin");
  const destination = fieldValue(formData, "destination");
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
  const { data, error } = await supabase.rpc("create_ride", {
    p_origin: origin,
    p_destination: destination,
    p_departs_at: localTime.iso,
    p_seats: seats,
    p_notes: notes,
    p_audience: fieldValue(formData, "audience") || "anyone",
  });

  if (error) {
    return { error: errorCopy(error.message) };
  }

  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/rides/[id]", "page");
  redirect(`/rides/${data}?welcome=posted`);
}
