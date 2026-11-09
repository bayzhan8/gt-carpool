"use server";

import { redirect } from "next/navigation";
import { authErrorCopy, errorCopy } from "@/lib/errors";
import { isGatechEmail, normalizeEmail } from "@/lib/email";
import { safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";

export type VerifyOtpState = {
  error?: string;
};

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function verifyOtpAction(
  _previousState: VerifyOtpState,
  formData: FormData,
): Promise<VerifyOtpState> {
  const email = normalizeEmail(fieldValue(formData, "email"));
  const token = fieldValue(formData, "token");
  const next = safeNextPath(fieldValue(formData, "next"));

  if (!isGatechEmail(email)) {
    return { error: "Use your @gatech.edu email." };
  }

  if (!/^\d{6}$/.test(token)) {
    return { error: "That code is wrong or expired." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: authErrorCopy(error) };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Something went wrong. Try again." };
  }

  const { data: profile, error: profileError } =
    await supabase.rpc("get_my_profile");

  if (profileError) {
    return { error: errorCopy(profileError.message) };
  }

  const destination = next === "/welcome" ? "/" : next;

  if (profile !== null) {
    redirect(destination);
  }

  redirect(`/welcome?next=${encodeURIComponent(destination)}`);
}
