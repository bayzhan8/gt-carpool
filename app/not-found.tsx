import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <section className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        This page isn&apos;t here.
      </h1>
      <Link
        className="inline-flex min-h-11 items-center rounded-[10px] border border-hairline px-4 font-medium"
        href="/"
      >
        Go home
      </Link>
    </section>
  );
}
