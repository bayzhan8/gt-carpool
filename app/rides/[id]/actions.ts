"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireProfile } from "@/lib/auth";
import { errorCopy } from "@/lib/errors";
import { drainOutbox } from "@/lib/notifications/drain";
import { createClient } from "@/lib/supabase/server";

export type RideActionState = {
  error?: string;
  success?: boolean;
};

async function mutateRide(
  rideId: string,
  mutation: "join_ride" | "leave_ride" | "cancel_ride",
): Promise<RideActionState> {
  await requireProfile(`/rides/${rideId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc(mutation, { p_ride_id: rideId });

  if (error) {
    return { error: errorCopy(error.message) };
  }

  after(async () => {
    await drainOutbox();
  });
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath(`/rides/${rideId}`);
  if (mutation === "join_ride") {
    redirect(`/rides/${rideId}?welcome=joined`);
  }
  return { success: true };
}

export async function joinRideAction(
  rideId: string,
  _previousState: RideActionState,
  _formData: FormData,
): Promise<RideActionState> {
  void _previousState;
  void _formData;
  return mutateRide(rideId, "join_ride");
}

export async function leaveRideAction(
  rideId: string,
  _previousState: RideActionState,
  _formData: FormData,
): Promise<RideActionState> {
  void _previousState;
  void _formData;
  return mutateRide(rideId, "leave_ride");
}

export async function cancelRideAction(
  rideId: string,
  _previousState: RideActionState,
  _formData: FormData,
): Promise<RideActionState> {
  void _previousState;
  void _formData;
  return mutateRide(rideId, "cancel_ride");
}
