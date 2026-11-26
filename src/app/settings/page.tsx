import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAccount } from "@/lib/queries/users";
import { ProfileForm, PasswordForm, DeleteAccountForm } from "@/components/user/AccountForms";
import { SectionHeader } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/signin?next=/settings");
  const acct = getAccount(me.id);
  if (!acct) redirect("/signin?next=/settings");

  return (
    <div className="page py-10 md:py-14">
      <SectionHeader as="h1" kanji="設定 · Account" title="Account settings" subtitle="Your public profile, password and account." />

      <div className="grid gap-12 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-14">
          <section aria-labelledby="profile-h">
            <h2 id="profile-h" className="lbl mb-5 border-b border-hair pb-3 text-cobalt">Profile</h2>
            <ProfileForm initial={{ displayName: acct.displayName, bio: acct.bio, location: acct.location }} />
          </section>

          <section aria-labelledby="pw-h">
            <h2 id="pw-h" className="lbl mb-5 border-b border-hair pb-3 text-cobalt">Password</h2>
            <PasswordForm />
          </section>

          <section aria-labelledby="danger-h">
            <h2 id="danger-h" className="lbl mb-5 border-b border-hair pb-3 text-down">Delete account</h2>
            <p className="mb-5 max-w-xl text-[15px] text-muted">
              Deleting your account is permanent. Your ratings, reviews, lists and Reading List go with it.
              Other members&apos; books and reviews are unaffected.
            </p>
            {me.username === "demo" ? (
              <p className="text-[14px] text-muted">The shared demo account can&apos;t be deleted.</p>
            ) : (
              <DeleteAccountForm username={me.username} />
            )}
          </section>
        </div>

        <aside className="h-fit border border-hair bg-sheet p-6">
          <p className="lbl text-muted">Signed in as</p>
          <p className="mt-2 text-lg font-semibold">{acct.displayName}</p>
          <p className="text-[14px] text-muted">@{acct.username}</p>
          <p className="mt-1 break-all text-[14px] text-muted">{acct.email ?? "Demo account"}</p>
          <nav className="mt-6 flex flex-col gap-1 text-[14px] font-semibold" aria-label="Account shortcuts">
            <Link href={`/user/${acct.username}`} className="py-1.5 hover:text-cobalt hover:underline">View your profile</Link>
            <Link href="/readinglist" className="py-1.5 hover:text-cobalt hover:underline">Reading List</Link>
            <Link href="/you/ratings" className="py-1.5 hover:text-cobalt hover:underline">Your ratings</Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
