import type { Metadata } from "next";
import { connection } from "next/server";
import { AccountTabs } from "@/app/account-tabs";
import { requireProfile } from "@/lib/auth";
import { formatUsPhone } from "@/lib/phone";
import { myRides } from "@/lib/rides";
import { signOutAction } from "@/app/me/actions";
import { DeleteAccountDialog } from "@/app/me/delete-account-dialog";
import { WelcomeForm } from "@/app/welcome/welcome-form";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  await connection();
  const { user, profile } = await requireProfile("/profile");
  const rides = await myRides();
  const genderLocked = rides.some(
    (ride) =>
      !ride.is_past && ride.status === "active" && ride.audience !== "anyone",
  );

  return (
    <section className="space-y-6">
      <AccountTabs active="profile" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm text-muted">Manage your contact details.</p>
      </div>
      <dl className="space-y-1">
        <dt className="text-sm font-medium">Email</dt>
        <dd className="text-sm">{user.email}</dd>
        <dd className="text-sm text-muted">
          Your GT email can&apos;t be changed.
        </dd>
      </dl>
      <WelcomeForm
        askGender
        genderLocked={genderLocked}
        initialValues={{
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: formatUsPhone(profile.phone),
          venmo: profile.venmo ?? "",
          gender: profile.gender,
          show_phone: profile.show_phone,
        }}
        keepOnPage
        next="/profile"
        submitLabel="Save profile"
      />
      <form action={signOutAction}>
        <button
          className="min-h-11 w-full rounded-[10px] border border-hairline px-4 font-medium hover:bg-surface"
          type="submit"
        >
          Sign out
        </button>
      </form>
      <div className="border-t border-hairline pt-4">
        <DeleteAccountDialog />
      </div>
    </section>
  );
}
