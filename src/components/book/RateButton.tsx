"use client";

import { useEffect, useRef, useState } from "react";
import { rateBook } from "@/app/actions/engagement";
import { StarIcon } from "./Rating";
import { useAuthAction } from "./useAuthAction";

/**
 * IMDb-style rating control: an outline-star "Rate" button that opens a 10-star dialog.
 * variant "inline" = small text button for cards; "hero" = stacked label for the book page.
 */
export function RateButton({
  bookId, title, current, variant = "inline",
}: { bookId: string; title: string; current: number | null; variant?: "inline" | "hero" }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number | null>(current);
  const [hover, setHover] = useState<number | null>(null);
  const { run, pending } = useAuthAction();
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => setValue(current), [current]);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const shown = hover ?? value ?? 0;
  const submit = (score: number | null) =>
    run(() => rateBook(bookId, score), () => {
      setValue(score);
      setOpen(false);
    });

  return (
    <>
      {variant === "hero" ? (
        <button type="button" onClick={() => setOpen(true)} className="group flex flex-col items-center gap-1 text-left">
          <span className="lbl text-muted">Your rating</span>
          <span className="inline-flex items-center gap-1.5 text-lg font-semibold text-cobalt group-hover:underline">
            <StarIcon className="h-6 w-6" filled={!!value} />
            {value ? <span><span className="text-ink">{value}</span><span className="text-sm text-muted">/10</span></span> : "Rate"}
          </span>
        </button>
      ) : (
        <button type="button" onClick={(e) => { e.preventDefault(); setOpen(true); }}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[13px] font-semibold text-cobalt hover:bg-cobalt-soft"
          aria-label={value ? `Your rating: ${value}. Change rating for ${title}` : `Rate ${title}`}>
          <StarIcon className="h-3.5 w-3.5" filled={!!value} />
          {value ?? <span className="sr-only">Rate</span>}
        </button>
      )}

      <dialog ref={dlg} onClose={() => setOpen(false)} onClick={(e) => e.target === dlg.current && setOpen(false)}
        className="m-auto w-[min(92vw,520px)] overflow-visible bg-transparent p-0 backdrop:bg-black/70">
        <div className="relative bg-sheet px-6 pb-7 pt-14 text-center text-ink shadow-card">
          <div className="absolute -top-11 left-1/2 flex h-[88px] w-[88px] -translate-x-1/2 items-center justify-center">
            <StarIcon className="absolute inset-0 h-full w-full text-cobalt" />
            <span className="relative text-2xl font-semibold text-cobalt-ink">{shown || "?"}</span>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="lbl box absolute right-3 top-3 text-muted" aria-label="Close">Close</button>
          <p className="lbl text-cobalt">Rate this</p>
          <p className="mt-2 text-xl font-semibold">{title}</p>
          <div className="mt-6 flex justify-center gap-0.5" onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Rating out of 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onClick={() => setValue(n)}
                className="p-0.5 transition-transform hover:scale-110">
                <StarIcon className={`h-7 w-7 ${n <= shown ? "text-cobalt" : "text-muted/50"}`} filled={n <= shown} />
              </button>
            ))}
          </div>
          <div className="mt-7 flex flex-col items-center gap-2">
            <button type="button" disabled={!value || pending} onClick={() => submit(value)} className="btn btn-primary w-56 disabled:opacity-40">
              {pending ? "Saving…" : "Rate"}
            </button>
            {current && (
              <button type="button" disabled={pending} onClick={() => submit(null)} className="btn btn-ghost btn-sm text-cobalt">
                Remove rating
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
