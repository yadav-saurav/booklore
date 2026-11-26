import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/components/user/safeNext";
import { AuthForm } from "@/components/user/AuthForm";
import { signIn } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next);
  if (await getCurrentUser()) redirect(to);

  return (
    <div className="page grid min-h-[70svh] items-center gap-12 py-14 md:grid-cols-[1fr_minmax(0,420px)] md:py-24">
      <section>
        <p className="lbl text-cobalt font-jp">会員 · Members</p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Sign in to your archive</h1>
        <p className="prose-serif mt-5 max-w-lg text-ink-2">
          Rate what you have read, keep a Reading List, write reviews and build lists for other readers to find.
        </p>
        <p className="mt-6 text-[14px] text-muted">
          Not a member yet?{" "}
          <Link href={to !== "/" ? `/register?next=${encodeURIComponent(to)}` : "/register"} className="font-semibold text-cobalt hover:underline">
            Create a free account
          </Link>
        </p>
      </section>
      <section className="border border-hair bg-sheet p-6 shadow-card sm:p-8" aria-labelledby="signin-h">
        <h2 id="signin-h" className="lbl mb-6 text-ink-2">Sign in</h2>
        <AuthForm mode="signin" action={signIn} next={to} />
      </section>
    </div>
  );
}
