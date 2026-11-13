import Link from "next/link";

export function AccountTabs({ active }: { active: "me" | "profile" }) {
  return (
    <nav
      aria-label="Account"
      className="grid grid-cols-2 rounded-[10px] bg-surface p-1"
    >
      <Link
        aria-current={active === "me" ? "page" : undefined}
        className={`flex min-h-11 items-center justify-center rounded-[8px] text-sm font-medium ${
          active === "me" ? "bg-white shadow-sm" : "text-muted"
        }`}
        href="/me"
      >
        My rides
      </Link>
      <Link
        aria-current={active === "profile" ? "page" : undefined}
        className={`flex min-h-11 items-center justify-center rounded-[8px] text-sm font-medium ${
          active === "profile" ? "bg-white shadow-sm" : "text-muted"
        }`}
        href="/profile"
      >
        Profile
      </Link>
    </nav>
  );
}
