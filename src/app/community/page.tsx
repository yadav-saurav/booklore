import type { Metadata } from "next";
import Link from "next/link";
import { topReviewers, mostFollowed, recentlyActive } from "@/lib/queries/users";
import { SectionHeader } from "@/components/ui/Section";
import { Avatar } from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/util";

export const metadata: Metadata = { title: "Community" };

function MemberLink({ m }: { m: { username: string; displayName: string; avatarHue: number; isMock: boolean } }) {
  return (
    <Link href={`/user/${m.username}`} className="group flex min-w-0 items-center gap-3">
      <Avatar name={m.displayName} hue={m.avatarHue} size={40} />
      <span className="min-w-0">
        <span className="block truncate font-semibold group-hover:text-cobalt group-hover:underline">{m.displayName}</span>
        <span className="block truncate text-[13px] text-muted">@{m.username}</span>
      </span>
    </Link>
  );
}

export default async function CommunityPage() {
  const reviewers = await topReviewers(10);
  const followed = await mostFollowed(10);
  const active = await recentlyActive(12);

  return (
    <div className="page py-10 md:py-14">
      <SectionHeader as="h1" kanji="読者たち · Community" title="Community"
        subtitle="The readers who write, rate and follow the most. Member data on this page is sample data." />

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="top-reviewers-h">
          <h2 id="top-reviewers-h" className="sec-title mb-6 text-[20px]">Top reviewers</h2>
          {reviewers.length === 0 ? (
            <p className="text-[15px] text-muted">No reviews yet.</p>
          ) : (
            <ol className="border-t border-hair">
              {reviewers.map((r, i) => (
                <li key={r.id} className="flex items-center gap-4 border-b border-hair py-3.5">
                  <span className="w-7 text-right text-lg font-light tabular-nums text-muted" aria-hidden>{i + 1}</span>
                  <div className="min-w-0 flex-1"><MemberLink m={r} /></div>
                  <div className="shrink-0 text-right text-[13px]">
                    <p><span className="font-semibold text-ink tabular-nums">{r.reviews}</span> <span className="text-muted">{r.reviews === 1 ? "review" : "reviews"}</span></p>
                    <p className="text-muted"><span className="font-semibold text-ink-2 tabular-nums">{r.helpful.toLocaleString("en-US")}</span> helpful votes</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="followed-h">
          <h2 id="followed-h" className="sec-title mb-6 text-[20px]">Most followed readers</h2>
          {followed.length === 0 ? (
            <p className="text-[15px] text-muted">Nobody has followed anyone yet.</p>
          ) : (
            <ol className="border-t border-hair">
              {followed.map((r, i) => (
                <li key={r.id} className="flex items-center gap-4 border-b border-hair py-3.5">
                  <span className="w-7 text-right text-lg font-light tabular-nums text-muted" aria-hidden>{i + 1}</span>
                  <div className="min-w-0 flex-1"><MemberLink m={r} /></div>
                  <p className="shrink-0 text-right text-[13px]"><span className="font-semibold text-ink tabular-nums">{r.followers.toLocaleString("en-US")}</span> <span className="text-muted">followers</span></p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="active-h" className="mt-16 border-t border-hair pt-12">
        <h2 id="active-h" className="sec-title mb-6 text-[20px]">Recently active</h2>
        <ul className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 border border-hair bg-sheet p-4">
              <MemberLink m={m} />
              {m.bio && <p className="line-clamp-2 text-[13.5px] text-ink-2">{m.bio}</p>}
              <p className="mt-auto text-[12.5px] text-muted">Active {timeAgo(m.lastActive)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
