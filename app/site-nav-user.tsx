import Link from "next/link";
import { connection } from "next/server";
import { getViewer } from "@/lib/auth";

export async function SiteNavUser() {
  await connection();
  const { user, profile } = await getViewer();
  const initials = profile
    ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
    : user?.email.charAt(0).toUpperCase();

  return user ? (
    <Link
      aria-label={`${initials} Your profile`}
      className="flex size-8 items-center justify-center rounded-full bg-surface text-xs font-semibold"
      href="/me"
      prefetch={false}
    >
      {initials}
    </Link>
  ) : (
    <Link
      className="flex min-h-11 items-center px-2 text-sm text-muted hover:text-text"
      href="/signin"
    >
      Sign in
    </Link>
  );
}
