import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy | GT Carpool",
  description: "What GT Carpool stores and who can see your information.",
};

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted">
          GT Carpool helps Georgia Tech students coordinate shared rides to the
          airport.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we store</h2>
        <p>
          We store your Georgia Tech email, name, phone number, optional Venmo
          handle, gender (optional), and ride details such as route, time,
          seats, notes, and membership.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Who can see it</h2>
        <p>
          Anyone can see a ride’s route, departure time, and available seats.
          Contact details are shown only to people in the same ride.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ads and tracking</h2>
        <p>We do not use ads or trackers.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Deleting your account</h2>
        <p>
          Deleting your account removes your profile and pulls you from upcoming
          rides.
        </p>
      </section>

      <p>
        Questions or concerns?{" "}
        <a
          className="underline underline-offset-2"
          href="https://github.com/bayzhan8/gt-carpool/issues"
        >
          Contact us through GitHub issues
        </a>
        .
      </p>
    </article>
  );
}
