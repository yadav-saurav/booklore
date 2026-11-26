"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleListLike } from "@/app/actions/lists";

/** Like / unlike a list. Anonymous visitors are sent to sign-in and returned to the list. */
export function LikeButton({ listId, initialLiked, initialCount }: { listId: number; initialLiked: boolean; initialCount: number }) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={liked}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleListLike(listId);
          if (!r.ok && r.error === "auth") router.push(`/signin?next=${encodeURIComponent(`/list/${listId}`)}`);
          else if (r.ok) { setLiked(r.liked); setCount(r.likeCount); }
        })
      }
      className={`btn btn-sm gap-2 ${liked ? "btn-primary" : "btn-outline"} disabled:opacity-60`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.4 5 7 5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.6 4.5 6.8C19.5 16.4 12 21 12 21z" strokeLinejoin="round" />
      </svg>
      {liked ? "Liked" : "Like"} <span className="tabular-nums">{count}</span>
    </button>
  );
}
