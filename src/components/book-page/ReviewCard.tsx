"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteReview, reportReview, voteReview } from "@/app/actions/reviews";
import type { ReviewItem } from "@/lib/queries/book-page";
import { Avatar } from "@/components/ui/Avatar";
import { StarIcon } from "@/components/book/Rating";
import { fmtDate } from "@/lib/util";
import { useReviewAction } from "./useReviewAction";

const REASONS = [
  ["spoiler", "Contains unmarked spoilers"],
  ["offensive", "Offensive or abusive"],
  ["spam", "Spam or advertising"],
  ["off-topic", "Not about this book"],
  ["other", "Something else"],
] as const;

export function RatingBadge({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[14px]" aria-label={`Rated ${rating} out of 10`}>
      <StarIcon className="h-4 w-4 text-star" />
      <span className="font-semibold text-ink">{rating}</span>
      <span className="text-muted">/10</span>
    </span>
  );
}

function Thumb({ down, filled }: { down?: boolean; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${down ? "rotate-180" : ""}`} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M7 10v11H3V10zM7 10l4.5-7.5c1.4 0 2.5 1.1 2.3 2.5L13.2 9H19a2 2 0 0 1 2 2.3l-1.3 7.6A2.5 2.5 0 0 1 17.2 21H7" />
    </svg>
  );
}

/**
 * IMDb user review card: rating, headline, spoiler gate, clamped body with "Read more",
 * author + date, Helpful / Not helpful (one vote per user, toggleable), Report, and edit/delete for the author.
 */
export function ReviewCard({
  review, variant = "full", editHref, label,
}: { review: ReviewItem; variant?: "full" | "compact" | "featured"; editHref?: string; label?: string }) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [vote, setVote] = useState<{ mine: 1 | 0 | null; up: number; down: number }>({ mine: review.myVote, up: review.helpfulCount, down: review.unhelpfulCount });
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(review.reported);
  const [overflow, setOverflow] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const { run, pending, error } = useReviewAction();

  useEffect(() => setVote({ mine: review.myVote, up: review.helpfulCount, down: review.unhelpfulCount }), [review.myVote, review.helpfulCount, review.unhelpfulCount]);
  const hidden = review.spoiler && !revealed;
  useEffect(() => {
    const el = body.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 4);
  }, [hidden, review.body]);

  const doVote = (helpful: boolean) => {
    const h = helpful ? 1 : 0;
    const prev = vote;
    const next = { ...vote };
    if (vote.mine !== null) { if (vote.mine === 1) next.up--; else next.down--; }
    if (vote.mine === h) next.mine = null;
    else { next.mine = h; if (h) next.up++; else next.down++; }
    setVote(next);
    run(async () => {
      const r = await voteReview(review.id, helpful);
      if (!r.ok) setVote(prev);
      return r;
    });
  };

  const clamp = variant === "compact" ? "line-clamp-5" : variant === "featured" ? "line-clamp-[7]" : "line-clamp-[9]";
  const paragraphs = review.body.split(/\n{2,}/);
  const edited = review.updatedAt - review.createdAt > 60;

  return (
    <article className={`flex h-full flex-col border border-hair bg-card ${variant === "compact" ? "p-5" : "p-5 md:p-6"}`}
      aria-labelledby={`rv-${review.id}-h`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {label && <span className="lbl box border-cobalt text-cobalt">{label}</span>}
          <RatingBadge rating={review.rating} />
        </div>
        {review.spoiler && <span className="lbl text-vermilion">Spoiler</span>}
      </div>

      <h3 id={`rv-${review.id}-h`} className={`mt-3 font-semibold leading-snug ${variant === "featured" ? "text-[20px]" : "text-[17px]"} ${variant === "compact" ? "line-clamp-2" : ""}`}>
        {review.headline}
      </h3>

      {hidden ? (
        <div className="mt-3 flex flex-1 flex-col items-start gap-3 border border-dashed border-vermilion/50 bg-vermilion/5 p-4">
          <p className="text-[14px] text-ink-2"><span className="font-semibold text-vermilion">Warning: Spoilers.</span> This review reveals plot details.</p>
          <button type="button" onClick={() => setRevealed(true)} className="btn btn-sm btn-outline">Reveal spoiler</button>
        </div>
      ) : (
        <div className="mt-2.5 flex-1">
          <div ref={body} className={`prose-serif space-y-3 text-[16px] text-ink-2 ${expanded ? "" : clamp}`}>
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {(overflow || expanded) && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[14px] font-semibold text-cobalt hover:underline">
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hair pt-3.5">
        <Link href={`/user/${review.username}`} className="group flex min-w-0 items-center gap-2.5">
          <Avatar name={review.displayName} hue={review.avatarHue} size={30} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-semibold group-hover:text-cobalt group-hover:underline">{review.displayName}</span>
            <span className="block text-[12px] text-muted">{fmtDate(review.createdAt)}{edited ? " · edited" : ""}</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {review.mine ? (
            <>
              {editHref && <Link href={editHref} className="btn btn-ghost btn-sm text-cobalt">Edit</Link>}
              <button type="button" disabled={pending} className="btn btn-ghost btn-sm text-down"
                onClick={() => { if (confirm("Delete your review? This can't be undone.")) run(() => deleteReview(review.id)); }}>
                Delete
              </button>
            </>
          ) : (
            <>
              <span className="mr-1 text-[12px] text-muted max-sm:hidden">Helpful?</span>
              <button type="button" onClick={() => doVote(true)} aria-pressed={vote.mine === 1} aria-label={`Helpful (${vote.up})`}
                className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] font-semibold tabular-nums transition-colors hover:bg-cobalt-soft ${vote.mine === 1 ? "text-cobalt" : "text-ink-2"}`}>
                <Thumb filled={vote.mine === 1} /> {vote.up}
              </button>
              <button type="button" onClick={() => doVote(false)} aria-pressed={vote.mine === 0} aria-label={`Not helpful (${vote.down})`}
                className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] font-semibold tabular-nums transition-colors hover:bg-cobalt-soft ${vote.mine === 0 ? "text-cobalt" : "text-ink-2"}`}>
                <Thumb down filled={vote.mine === 0} /> {vote.down}
              </button>
              <div className="relative">
                <button type="button" onClick={() => setReporting((v) => !v)} disabled={reported} aria-expanded={reporting}
                  className="inline-flex h-8 items-center rounded-sm px-2 text-[12px] font-semibold text-muted hover:bg-hair-2 hover:text-ink disabled:hover:bg-transparent">
                  {reported ? "Reported" : "Report"}
                </button>
                {reporting && (
                  <div className="absolute bottom-full right-0 z-30 mb-2 w-64 border border-hair bg-sheet p-3 shadow-card" role="dialog" aria-label="Report this review">
                    <p className="lbl mb-2 text-muted">Report this review</p>
                    {REASONS.map(([k, l]) => (
                      <button key={k} type="button" className="block w-full px-2 py-1.5 text-left text-[13px] hover:bg-cobalt-soft hover:text-cobalt"
                        onClick={() => run(() => reportReview(review.id, k), () => { setReported(true); setReporting(false); })}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-[13px] text-down" role="alert">{error}</p>}
    </article>
  );
}
