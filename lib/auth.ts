import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/database.types";
import { safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  show_phone: boolean;
  venmo: string | null;
  gender: "man" | "woman" | "unspecified" | null;
};

export type Gender = "man" | "woman" | "unspecified";
export type CompleteProfile = Profile;

export type ViewerUser = {
  id: string;
  email: string;
};

function isProfile(value: Json | null): value is Profile {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.first_name === "string" &&
    typeof value.last_name === "string" &&
    typeof value.phone === "string" &&
    typeof value.show_phone === "boolean" &&
    (typeof value.venmo === "string" || value.venmo === null) &&
    (value.gender === "man" ||
      value.gender === "woman" ||
      value.gender === "unspecified" ||
      value.gender === null)
  );
}

export const getViewer = cache(
  async (): Promise<{ user: ViewerUser | null; profile: Profile | null }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, profile: null };
    }

    const { data, error } = await supabase.rpc("get_my_profile");

    if (error) {
      throw new Error(error.message);
    }

    return {
      user: { id: user.id, email: user.email ?? "" },
      profile: isProfile(data) ? data : null,
    };
  },
);

function withNext(path: string, next: string) {
  return `${path}?next=${encodeURIComponent(safeNextPath(next))}`;
}

export async function requireUser(next: string): Promise<ViewerUser> {
  const { user } = await getViewer();

  if (!user) {
    redirect(withNext("/signin", next));
  }

  return user;
}

export async function requireProfile(
  next: string,
): Promise<{ user: ViewerUser; profile: CompleteProfile }> {
  const user = await requireUser(next);
  const { profile } = await getViewer();

  if (!profile) {
    redirect(withNext("/welcome", next));
  }

  return { user, profile };
}
