import Link from "next/link";

export default function NotFound() {
  return (
    <section className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        This ride isn&apos;t here.
      </h1>
      <p className="text-sm text-muted">
        It may have been cancelled, or the link is wrong.
      </p>
      <Link
        className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-4 font-medium"
        href="/"
      >
        Back to rides
      </Link>
    </section>
  );
}
