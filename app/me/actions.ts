"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  redirect("/");
}

export async function deleteAccountAction() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    throw new Error(error.message);
  }

  await supabase.auth.signOut();
  redirect("/");
}
