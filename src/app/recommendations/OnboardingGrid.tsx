"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rateForPicks } from "@/app/actions/recommendations";
import { BookCover } from "@/components/book/BookCover";
import { StarIcon } from "@/components/book/Rating";
import { useAuthAction } from "@/components/book/useAuthAction";

type Item = { id: string; title: string; authorName: string | null; year: number | null; coverId: number | null; coverUrl: string | null };

const SKIP_KEY = "bl-onboard-skip";

function readSkips(): string[] {
  try { return JSON.parse(sessionStorage.getItem(SKIP_KEY) || "[]"); } catch { return []; }
}

/** "Rate books you've read" grid with inline 1–10 star pickers and a "Haven't read it" skip. */
export function OnboardingGrid({ books, rated, target = 5 }: { books: Item[]; rated: number; target?: number }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => setSkipped(readSkips()), []);
  const skip = (id: string) => {
    const next = [...new Set([...skipped, id])];
    setSkipped(next);
    try { sessionStorage.setItem(SKIP_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };
  const visible = books.filter((b) => !skipped.includes(b.id));
  const pct = Math.min(100, Math.round((rated / target) * 100));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2" aria-live="polite">
        <div className="h-1.5 w-48 overflow-hidden bg-hair" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(rated, target)} aria-label="Ratings toward tuned picks">
          <div className="h-full bg-cobalt transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[14px] text-ink-2">
          {rated >= target
            ? <>You&apos;ve rated <b>{rated}</b> books. Keep going, every rating sharpens your picks.</>
            : <><b>{rated}</b> of {target} rated. {target - rated} more to tune your picks.</>}
        </p>
      </div>
      {visible.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((b) => <OnboardCard key={b.id} book={b} onSkip={() => skip(b.id)} />)}
        </ul>
      ) : (
        <p className="box-border border border-dashed border-hair p-6 text-center text-muted">
          That&apos;s the whole stack for now. <Link href="/chart/top" className="text-cobalt hover:underline">Browse the Top 250</Link> to rate more.
        </p>
      )}
    </div>
  );
}

function OnboardCard({ book, onSkip }: { book: Item; onSkip: () => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const { run, pending } = useAuthAction();
  const rate = (n: number) => { setValue(n); run(() => rateForPicks(book.id, n)); };
  const shown = hover ?? value ?? 0;

  return (
    <li className={`flex flex-col transition-transform ${pending ? "scale-[.98]" : ""}`}>
      <Link href={`/book/${book.id}`} className="block focus-visible:outline-2 focus-visible:outline-cobalt">
        <BookCover book={book} className="shadow-[0_1px_0_var(--hair)]" />
      </Link>
      <p className="mt-2 line-clamp-2 min-h-[2.5em] text-[14px] font-semibold leading-tight">{book.title}</p>
      <p className="truncate text-[12px] text-muted">{book.authorName ?? "Unknown author"}{book.year ? ` · ${book.year}` : ""}</p>
      <div className="mt-2 flex justify-between" role="radiogroup" aria-label={`Rate ${book.title} out of 10`} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 10`} disabled={pending}
            onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(null)} onClick={() => rate(n)}
            className="-mx-px rounded-sm p-px focus-visible:outline-2 focus-visible:outline-cobalt disabled:cursor-wait">
            <StarIcon className={`h-[15px] w-[15px] transition-colors ${n <= shown ? "text-cobalt" : "text-muted/40"}`} filled={n <= shown} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[12px]">
        <span className="font-semibold text-cobalt tabular-nums">{pending ? "Saving…" : shown ? `${shown}/10` : " "}</span>
        <button type="button" onClick={onSkip} className="rounded-sm px-1 py-0.5 text-muted hover:bg-hair-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-cobalt">
          Haven&apos;t read it
        </button>
      </div>
    </li>
  );
}
