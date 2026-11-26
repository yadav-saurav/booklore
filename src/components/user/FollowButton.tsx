"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFollow } from "@/app/actions/account";

/** Follow / Unfollow a member. Anonymous visitors go to sign-in and come back here. */
export function FollowButton({ targetId, username, initial }: { targetId: number; username: string; initial: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={following}
      onClick={() =>
        start(async () => {
          const r = await toggleFollow(targetId);
          if (!r.ok && r.error === "auth") router.push(`/signin?next=${encodeURIComponent(`/user/${username}`)}`);
          else if (r.ok) { setFollowing(!!r.following); router.refresh(); }
        })
      }
      className={`btn h-10 min-w-[8.5rem] ${following ? "btn-outline" : "btn-primary"} disabled:opacity-60`}
    >
      {pending ? "…" : following ? "Following ✓" : "Follow"}
    </button>
  );
}
