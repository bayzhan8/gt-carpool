import { connection } from "next/server";
import { requireProfile } from "@/lib/auth";
import { myRides } from "@/lib/rides";
import { formatUsPhone } from "@/lib/phone";
import { RideCard } from "@/app/rides/ride-card";
import { signOutAction } from "./actions";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { WelcomeForm } from "@/app/welcome/welcome-form";

export default async function MePage() {
  await connection();
  const { user, profile } = await requireProfile("/me");
  const rides = await myRides();
  const upcoming = rides.filter(
    (ride) => !ride.is_past && ride.status === "active",
  );
  const past = rides.filter((ride) => ride.is_past || ride.status !== "active");
  const genderLocked = rides.some(
    (ride) =>
      !ride.is_past && ride.status === "active" && ride.audience !== "anyone",
  );

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
          <dd className="mt-1 text-sm">{formatUsPhone(profile.phone)}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted">Venmo</dt>
          <dd className="mt-1 text-sm">{profile.venmo ?? "Not set"}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted">Group</dt>
          <dd className="mt-1 text-sm">{profile.gender}</dd>
        </div>
      </dl>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length ? (
          upcoming.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p className="text-sm text-muted">No upcoming rides.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Past &amp; cancelled</h2>
        {past.length ? (
          past.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p className="text-sm text-muted">No past rides.</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Edit profile</h2>
        <WelcomeForm
          initialValues={{
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: formatUsPhone(profile.phone),
            venmo: profile.venmo ?? "",
            gender: profile.gender,
          }}
          genderLocked={genderLocked}
          next="/me"
          submitLabel="Save profile"
        />
      </section>
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
