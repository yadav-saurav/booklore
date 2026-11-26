"use client";

import { useActionState, useState } from "react";
import { changePassword, deleteAccount, updateProfile, type AccountFormState } from "@/app/actions/account";

const inputClass = "field h-11 text-[15px]";

function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="lbl text-ink-2">{label}</label>
      {children}
      {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
    </div>
  );
}

function Alert({ error, saved }: { error?: string; saved?: boolean }) {
  if (error) return <p role="alert" className="border-l-2 border-vermilion bg-vermilion/10 px-3 py-2 text-[14px]">{error}</p>;
  if (saved) return <p role="status" className="border-l-2 border-up bg-up/10 px-3 py-2 text-[14px]">Saved.</p>;
  return null;
}

export function ProfileForm({ initial }: { initial: { displayName: string; bio: string; location: string | null } }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateProfile, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="grid gap-5 md:grid-cols-2">
      <Row id="displayName" label="Display name">
        <input id="displayName" name="displayName" required defaultValue={f.displayName ?? initial.displayName} className={inputClass} maxLength={40} />
      </Row>
      <Row id="location" label="Location" hint="City or region. Optional.">
        <input id="location" name="location" defaultValue={f.location ?? initial.location ?? ""} className={inputClass} maxLength={80} />
      </Row>
      <div className="md:col-span-2">
        <Row id="bio" label="Bio" hint="Up to 300 characters. Shown on your public profile.">
          <textarea id="bio" name="bio" rows={4} defaultValue={f.bio ?? initial.bio} className="field" maxLength={300} />
        </Row>
      </div>
      <div className="flex items-center gap-4 md:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">{pending ? "Saving…" : "Save profile"}</button>
        <div className="min-w-0 flex-1"><Alert error={state?.error} saved={state?.saved} /></div>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <Row id="currentPassword" label="Current password">
          <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className={inputClass} />
        </Row>
      </div>
      <Row id="newPassword" label="New password" hint="At least 8 characters.">
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required className={inputClass} />
      </Row>
      <Row id="confirmPassword" label="Confirm new password">
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputClass} />
      </Row>
      <div className="flex items-center gap-4 md:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-outline disabled:opacity-60">{pending ? "Updating…" : "Change password"}</button>
        <div className="min-w-0 flex-1"><Alert error={state?.error} saved={state?.saved} /></div>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<AccountFormState, FormData>(deleteAccount, undefined);
  const ready = typed.trim().toLowerCase() === username;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Row id="confirm" label={`Type ${username} to confirm`} hint="This removes your ratings, reviews, lists, shelves and follows. It can't be undone.">
        <input id="confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={inputClass} />
      </Row>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={!ready || pending}
          className="btn h-11 border border-down bg-transparent px-5 text-down hover:bg-down/10 disabled:opacity-40">
          {pending ? "Deleting…" : "Delete my account"}
        </button>
        <div className="min-w-0 flex-1"><Alert error={state?.error} /></div>
      </div>
    </form>
  );
}
