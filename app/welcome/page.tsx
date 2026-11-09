import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { getViewer, requireUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/next-path";
import { WelcomeForm } from "./welcome-form";

type WelcomePageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  await connection();
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);
  const { user, profile } = await getViewer();

  if (!user) {
    await requireUser(rawNext ? next : "/welcome");
  }

  if (profile?.gender) {
    redirect(next === "/welcome" ? "/" : next);
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
      <p className="mt-2 text-sm text-muted">
        Finish your profile to continue.
      </p>
      <WelcomeForm initialValues={profile ?? undefined} next={next} />
      <p className="mt-4 text-sm text-muted">
        <Link className="underline underline-offset-2" href="/privacy">
          Only people in your ride see your number.
        </Link>
      </p>
    </section>
  );
}
