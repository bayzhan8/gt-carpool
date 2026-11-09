import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "GT Carpool",
  description:
    "Split the Uber to the airport with other Georgia Tech students.",
};

export const viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
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
            <Link
              className="flex min-h-11 items-center px-2 text-sm text-muted hover:text-text"
              href="/signin"
            >
              Sign in
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[560px] px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
