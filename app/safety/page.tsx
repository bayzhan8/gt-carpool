import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Safety",
  description: "Simple safety steps for sharing an airport ride.",
};

export default function SafetyPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Safety</h1>
        <p className="text-sm text-muted">
          A few simple steps can make your shared ride safer.
        </p>
      </header>

      <ul className="list-disc space-y-4 pl-5">
        <li>
          Meet in a public, well-lit spot, such as a staffed campus entrance.
        </li>
        <li>
          Check the driver’s name and the vehicle’s license plate in the Uber or
          Lyft app before getting in.
        </li>
        <li>Share your trip with a friend.</li>
      </ul>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Need help?</h2>
        <p>
          Georgia Tech Police:{" "}
          <a
            className="min-h-11 text-lg font-semibold underline underline-offset-2"
            href="tel:+14048942500"
          >
            404-894-2500
          </a>
        </p>
        <p>
          For emergencies, call <strong>911</strong>.
        </p>
      </section>
    </article>
  );
}
