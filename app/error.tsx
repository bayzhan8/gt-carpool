"use client";

import Link from "next/link";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <section className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted">Please try again or return to rides.</p>
      <button
        className="min-h-11 rounded-[10px] border border-hairline px-4 font-medium"
        onClick={() => retry()}
        type="button"
      >
        Try again
      </button>
      <div>
        <Link
          className="inline-flex min-h-11 items-center rounded-[10px] px-4 font-medium text-muted"
          href="/"
        >
          Back to rides
        </Link>
      </div>
    </section>
  );
}
