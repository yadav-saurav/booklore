import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/components/user/safeNext";
import { AuthForm } from "@/components/user/AuthForm";
import { register } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next);
  if (await getCurrentUser()) redirect(to);

  return (
    <div className="page grid min-h-[70svh] items-center gap-12 py-14 md:grid-cols-[1fr_minmax(0,420px)] md:py-24">
      <section>
        <p className="lbl text-cobalt font-jp">入会 · Join</p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Start your own archive</h1>
        <ul className="prose-serif mt-6 max-w-lg list-none space-y-2 text-ink-2">
          <li>Rate books on a 1–10 scale and see how they compare.</li>
          <li>Keep a Reading List and track pages as you go.</li>
          <li>Publish lists and follow readers whose taste you trust.</li>
        </ul>
        <p className="mt-6 text-[14px] text-muted">
          Already a member?{" "}
          <Link href={to !== "/" ? `/signin?next=${encodeURIComponent(to)}` : "/signin"} className="font-semibold text-cobalt hover:underline">Sign in</Link>
        </p>
      </section>
      <section className="border border-hair bg-sheet p-6 shadow-card sm:p-8" aria-labelledby="register-h">
        <h2 id="register-h" className="lbl mb-6 text-ink-2">Create account</h2>
        <AuthForm mode="register" action={register} next={to} />
      </section>
    </div>
  );
}
