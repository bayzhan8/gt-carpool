import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-[560px] items-center gap-4 px-4 pb-6 text-sm text-muted">
      <Link className="inline-flex min-h-11 items-center" href="/privacy">
        Privacy
      </Link>
      <span aria-hidden="true">·</span>
      <Link className="inline-flex min-h-11 items-center" href="/safety">
        Safety
      </Link>
    </footer>
  );
}
