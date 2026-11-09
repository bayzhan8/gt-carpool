"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { errorCopy } from "@/lib/errors";
import { normalizeUsPhone } from "@/lib/phone";
import { safeNextPath } from "@/lib/next-path";
import { normalizeVenmo } from "@/lib/venmo";
import { createClient } from "@/lib/supabase/server";

export type WelcomeState = {
  errors?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    venmo?: string;
    form?: string;
  };
  values?: {
    first_name: string;
    last_name: string;
    phone: string;
    venmo: string;
  };
};

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveProfileAction(
  _previousState: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const firstName = fieldValue(formData, "first_name").trim();
  const lastName = fieldValue(formData, "last_name").trim();
  const rawPhone = fieldValue(formData, "phone");
  const rawVenmo = fieldValue(formData, "venmo");
  const next = safeNextPath(fieldValue(formData, "next"));

  await requireUser(next);

  const values = {
    first_name: firstName,
    last_name: lastName,
    phone: rawPhone,
    venmo: rawVenmo,
  };
  const errors: NonNullable<WelcomeState["errors"]> = {};

  if (!firstName || Array.from(firstName).length > 40) {
    errors.first_name = "Enter a first name up to 40 characters.";
  }

  if (!lastName || Array.from(lastName).length > 40) {
    errors.last_name = "Enter a last name up to 40 characters.";
  }

  const phone = normalizeUsPhone(rawPhone);
  if (!phone) {
    errors.phone = "Enter a US phone number";
  }

  const venmo = normalizeVenmo(rawVenmo);
  if (!venmo.ok) {
    errors.venmo = "Venmo handles are 5–30 letters, numbers, - or _";
  }

  if (Object.keys(errors).length > 0 || !phone || !venmo.ok) {
    return { errors, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_my_profile", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_phone: phone,
    p_venmo: venmo.value ?? "",
  });

  if (error) {
    return { errors: { form: errorCopy(error.message) }, values };
  }

  revalidatePath("/");
  revalidatePath("/me");
  redirect(next === "/welcome" ? "/" : next);
}
