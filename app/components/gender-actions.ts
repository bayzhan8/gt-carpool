"use server";

import { requireUser } from "@/lib/auth";
import { errorCopy } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type GenderActionState = {
  gender?: "man" | "woman" | "unspecified";
  error?: string;
};

export async function setGenderAction(
  _previousState: GenderActionState,
  formData: FormData,
): Promise<GenderActionState> {
  await requireUser("/");
  const gender = formData.get("gender");

  if (gender !== "man" && gender !== "woman" && gender !== "unspecified") {
    return { error: errorCopy("invalid_gender") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_gender", {
    p_gender: gender,
  });

  if (error) return { error: errorCopy(error.message) };
  return { gender: data as GenderActionState["gender"] };
}
