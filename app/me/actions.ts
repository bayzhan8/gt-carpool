"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { drainOutbox } from "@/lib/notifications/drain";
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

  after(async () => {
    await drainOutbox();
  });
  await supabase.auth.signOut();
  redirect("/");
}
