"use server";

import { after } from "next/server";
import { requireProfile } from "@/lib/auth";
import { errorCopy } from "@/lib/errors";
import { sendReportEmail } from "@/lib/report-email";
import { createClient } from "@/lib/supabase/server";

export type ReportActionState = {
  error?: string;
  success?: boolean;
};

export async function reportRideAction(
  rideId: string,
  _previousState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const { user } = await requireProfile(`/rides/${rideId}`);
  const reason = formData.get("reason");
  const details = formData.get("details");
  const reportReason = typeof reason === "string" ? reason : "";
  const reportDetails = typeof details === "string" ? details : "";
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_ride", {
    p_ride_id: rideId,
    p_reason: reportReason,
    p_details: reportDetails,
  });

  if (error) {
    return { error: errorCopy(error.message) };
  }

  after(async () => {
    const recipient = process.env.REPORTS_EMAIL;
    if (!recipient) {
      console.warn("REPORTS_EMAIL is unset; report email was skipped.");
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      await sendReportEmail({
        to: recipient,
        reporterEmail: user.email,
        reason: reportReason,
        details: reportDetails.trim(),
        rideUrl: new URL(`/rides/${rideId}`, baseUrl).href,
      });
    } catch {
      console.error("Ride report email delivery failed.");
    }
  });

  return { success: true };
}
