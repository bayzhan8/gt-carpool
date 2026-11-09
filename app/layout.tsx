import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getViewer } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "GT Carpool",
  description:
    "Split the Uber to the airport with other Georgia Tech students.",
  openGraph: {
    title: "GT Carpool",
    description:
      "Split the Uber to the airport with other Georgia Tech students.",
  },
};

export const viewport = {
  themeColor: "#FFFFFF",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const { user, profile } = await getViewer();
  const initials = profile
    ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
    : user?.email.charAt(0).toUpperCase();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-hairline">
          <nav
            aria-label="Main navigation"
            className="mx-auto flex min-h-14 max-w-[560px] items-center justify-between px-4"
          >
            <Link
              className="flex min-h-11 items-center font-semibold tracking-tight"
              href="/"
            >
              GT Carpool
            </Link>
            {user ? (
              <Link
                aria-label={`${initials} Your profile`}
                className="flex size-8 items-center justify-center rounded-full bg-surface text-xs font-semibold"
                href="/me"
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
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[560px] px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
