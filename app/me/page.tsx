import { connection } from "next/server";
import { requireProfile } from "@/lib/auth";
import { signOutAction } from "./actions";

export default async function MePage() {
  await connection();
  const { user, profile } = await requireProfile("/me");

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-2 text-sm text-muted">Your contact details.</p>
      </div>
      <dl className="divide-y divide-hairline rounded-[12px] border border-hairline">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted">Name</dt>
          <dd className="mt-1 text-sm">
            {profile.first_name} {profile.last_name}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted">Email</dt>
          <dd className="mt-1 text-sm">{user.email}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted">Phone</dt>
          <dd className="mt-1 text-sm">{profile.phone}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted">Venmo</dt>
          <dd className="mt-1 text-sm">{profile.venmo ?? "Not set"}</dd>
        </div>
      </dl>
      <form action={signOutAction}>
        <button
          className="min-h-11 w-full rounded-[10px] border border-hairline px-4 font-medium hover:bg-surface"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
