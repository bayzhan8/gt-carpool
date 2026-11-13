import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-[560px] flex-col items-start gap-1 px-4 pb-24 text-sm text-muted sm:pb-6">
      <div className="flex items-center gap-4">
        <Link className="inline-flex min-h-11 items-center" href="/privacy">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link className="inline-flex min-h-11 items-center" href="/safety">
          Safety
        </Link>
      </div>
      <p className="text-xs">
        Made by GT students. Not an official Georgia Tech service.
      </p>
    </footer>
  );
}
