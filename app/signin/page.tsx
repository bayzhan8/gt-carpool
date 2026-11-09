import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getViewer } from "@/lib/auth";
import { safeNextPath } from "@/lib/next-path";
import { SignInForm } from "./sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await connection();
  const params = await searchParams;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(nextParam);
  const { user } = await getViewer();

  if (user) {
    redirect(next);
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Use your Georgia Tech email to get a sign-in code.
      </p>
      <SignInForm next={next} />
    </section>
  );
}
