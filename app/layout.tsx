import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SiteNavUser } from "./site-nav-user";
import { SiteFooter } from "./site-footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://gtcarpool.vercel.app",
  ),
  title: {
    default: "GT Carpool",
    template: "%s · GT Carpool",
  },
  description:
    "Split the Uber to the airport with other Georgia Tech students.",
  openGraph: {
    title: "GT Carpool",
    description:
      "Split the Uber to the airport with other Georgia Tech students.",
  },
  twitter: {
    card: "summary_large_image",
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
            <Suspense
              fallback={
                <div
                  aria-hidden="true"
                  className="size-8 animate-pulse rounded-full bg-surface motion-reduce:animate-none"
                />
              }
            >
              <SiteNavUser />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[560px] px-4 py-8">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
