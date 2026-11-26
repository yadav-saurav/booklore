"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/actions/auth";

type Action = (prev: AuthState, form: FormData) => Promise<AuthState>;

/** Sign-in and register forms. Errors come back through useActionState, so nothing is lost on a bad submit. */
export function AuthForm({ mode, action, next }: { mode: "signin" | "register"; action: Action; next: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const f = state?.fields ?? {};
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {isRegister ? (
        <>
          <Field label="Your name" name="displayName" defaultValue={f.displayName} autoComplete="name" />
          <Field label="Username" name="username" defaultValue={f.username} autoComplete="username"
            hint="3–20 letters, numbers or _" />
          <Field label="Email" name="email" type="email" defaultValue={f.email} autoComplete="email" />
          <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" />
        </>
      ) : (
        <>
          <Field label="Email or username" name="identifier" defaultValue={f.identifier} autoComplete="username" />
          <Field label="Password" name="password" type="password" autoComplete="current-password" />
        </>
      )}

      {state?.error && (
        <p role="alert" className="border-l-2 border-vermilion bg-vermilion/10 px-3 py-2 text-[14px] text-ink">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary h-11 w-full text-[14px] disabled:opacity-60">
        {pending ? (isRegister ? "Creating your account…" : "Signing in…") : isRegister ? "Create account" : "Sign in"}
      </button>

      {!isRegister && (
        <div className="border border-dashed border-cobalt/60 bg-cobalt-soft px-4 py-3 text-[14px]">
          <p className="lbl text-cobalt">Demo account</p>
          <p className="mt-1.5 font-mono text-[13.5px] text-ink">Try demo@booklore.app / booklore123</p>
        </div>
      )}

      <p className="text-[14px] text-muted">
        {isRegister ? "Already a member? " : "New to BOOKLORE? "}
        <Link href={`${isRegister ? "/signin" : "/register"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-cobalt hover:underline">
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({ label, name, hint, type = "text", defaultValue, autoComplete }: {
  label: string; name: string; hint?: string; type?: string; defaultValue?: string; autoComplete?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="lbl text-ink-2">{label}</label>
      <input id={id} name={name} type={type} defaultValue={defaultValue} autoComplete={autoComplete} required
        className="field h-11 text-[15px]" aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <p id={`${id}-hint`} className="text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}
