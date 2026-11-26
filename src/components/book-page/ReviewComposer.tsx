"use client";

import { useEffect, useRef, useState } from "react";
import { saveReview, deleteReview } from "@/app/actions/reviews";
import { StarIcon } from "@/components/book/Rating";
import { useReviewAction } from "./useReviewAction";

const MIN_BODY = 50;

type Existing = { id: number; headline: string; body: string; spoiler: boolean } | null;

/** "+ Review" button and the write / edit dialog (headline, body, spoiler flag, required 1–10 rating). */
export function ReviewComposer({
  bookId, title, existing, currentRating, initialOpen = false, signedIn, variant = "button", className = "",
}: {
  bookId: string; title: string; existing: Existing; currentRating: number | null; initialOpen?: boolean; signedIn: boolean;
  variant?: "button" | "inline"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(currentRating);
  const [hover, setHover] = useState<number | null>(null);
  const [headline, setHeadline] = useState(existing?.headline ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [spoiler, setSpoiler] = useState(existing?.spoiler ?? false);
  const [touched, setTouched] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const { run, pending, error, setError } = useReviewAction();

  useEffect(() => { if (initialOpen && signedIn) setOpen(true); }, [initialOpen, signedIn]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const start = () => {
    if (!signedIn) {
      window.location.href = `/signin?next=${encodeURIComponent(`/book/${bookId}/reviews?write=1`)}`;
      return;
    }
    setRating(currentRating);
    setHeadline(existing?.headline ?? "");
    setBody(existing?.body ?? "");
    setSpoiler(existing?.spoiler ?? false);
    setTouched(false);
    setError(null);
    setOpen(true);
  };

  const len = body.trim().length;
  const problems = [!rating && "Choose a rating", headline.trim().length < 3 && "Add a headline", len < MIN_BODY && `Write at least ${MIN_BODY} characters`].filter(Boolean) as string[];
  const shown = hover ?? rating ?? 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (problems.length) return;
    run(() => saveReview({ bookId, headline, body, spoiler, rating: rating! }), () => setOpen(false));
  };

  return (
    <>
      {variant === "button" ? (
        <button type="button" onClick={start} className={`btn btn-outline ${className}`}>
          {existing ? "Edit your review" : (<><span aria-hidden className="text-[16px] leading-none">+</span> Review</>)}
        </button>
      ) : (
        <button type="button" onClick={start} className={`text-[14px] font-semibold text-cobalt hover:underline ${className}`}>
          {existing ? "Edit your review" : "Write a review"}
        </button>
      )}

      <dialog ref={dlg} onClose={() => setOpen(false)} aria-labelledby="review-dlg-title"
        className="m-auto max-h-[92svh] w-[min(94vw,640px)] overflow-y-auto bg-transparent p-0 backdrop:bg-black/70">
        <form onSubmit={submit} className="relative bg-sheet p-5 text-ink shadow-card md:p-7" noValidate>
          <button type="button" onClick={() => setOpen(false)} className="lbl box absolute right-4 top-4 text-muted hover:text-ink" aria-label="Close">Close</button>
          <p className="lbl text-cobalt">{existing ? "Edit your review" : "Add a review"}</p>
          <h2 id="review-dlg-title" className="mt-2 pr-16 text-[22px] font-semibold leading-tight">{title}</h2>

          <fieldset className="mt-6">
            <legend className="lbl mb-2.5 text-muted">Your rating <span className="text-vermilion">*</span></legend>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-0.5" role="radiogroup" aria-label="Rating out of 10" onMouseLeave={() => setHover(null)}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 10`}
                    onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5 transition-transform hover:scale-110">
                    <StarIcon className={`h-6 w-6 md:h-7 md:w-7 ${n <= shown ? "text-cobalt" : "text-muted/50"}`} filled={n <= shown} />
                  </button>
                ))}
              </div>
              <span className="text-[15px] font-semibold tabular-nums">{shown ? `${shown}/10` : <span className="text-muted">–/10</span>}</span>
            </div>
          </fieldset>

          <label className="mt-6 block">
            <span className="lbl mb-2 block text-muted">Headline <span className="text-vermilion">*</span></span>
            <input className="field" value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} placeholder="Sum up your review in a line" />
          </label>

          <label className="mt-5 block">
            <span className="lbl mb-2 flex justify-between text-muted">
              <span>Review <span className="text-vermilion">*</span></span>
              <span className={`tabular-nums normal-case tracking-normal ${len && len < MIN_BODY ? "text-vermilion" : ""}`}>
                {len < MIN_BODY ? `${MIN_BODY - len} more characters needed` : `${len.toLocaleString("en-US")} characters`}
              </span>
            </span>
            <textarea className="field prose-serif min-h-[200px] resize-y !text-[16px]" value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)}
              placeholder="What worked for you, and what didn't? Write in your own words." />
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14px]">
            <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--cobalt)]" />
            <span><span className="font-semibold">Contains spoilers</span><span className="block text-[13px] text-muted">Readers will have to click to reveal your review.</span></span>
          </label>

          {(touched && problems.length > 0) || error ? (
            <p className="mt-4 text-[13px] text-down" role="alert">{error ?? problems.join(" · ")}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="btn btn-primary min-w-40 disabled:opacity-50">
              {pending ? "Saving…" : existing ? "Save changes" : "Submit review"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
            {existing && (
              <button type="button" disabled={pending} className="btn btn-ghost ml-auto text-down"
                onClick={() => { if (confirm("Delete your review? This can't be undone.")) run(() => deleteReview(existing.id), () => setOpen(false)); }}>
                Delete review
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
