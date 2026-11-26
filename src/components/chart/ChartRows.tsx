import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import { RatingInline, RankDelta } from "@/components/book/Rating";
import { RateButton } from "@/components/book/RateButton";
import { ShelfRibbon } from "@/components/book/ShelfRibbon";
import type { BookCard, UserBookState } from "@/lib/queries/books";

export type ChartView = "list" | "grid" | "compact";
export const CHART_VIEWS: { value: ChartView; label: string }[] = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "compact", label: "Compact" },
];

type RowProps = {
  book: BookCard;
  rank: number;
  state?: UserBookState;
  /** BookMeter movement arrow, only on the popularity chart. */
  movement?: boolean;
};

/** Full row: rank, cover with ribbon, "N. Title", year · pages, ★ avg (votes), Rate star, info link. */
export function ChartListRow({ book, rank, state, movement }: RowProps) {
  const href = `/book/${book.id}`;
  return (
    <li className="group/row flex items-center gap-3 border-b border-hair py-3.5 md:gap-5">
      <span className="w-10 shrink-0 text-right text-[18px] font-semibold tabular-nums text-muted md:w-14" aria-label={`Rank ${rank}`}>
        {rank}
      </span>
      {movement && (
        <span className="w-9 shrink-0 md:w-12">
          <RankDelta rank={book.popularityRank} prev={book.prevPopularityRank} />
        </span>
      )}
      <div className="relative w-[52px] shrink-0 md:w-[64px]">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <BookCover book={book} size="S" />
        </Link>
        <ShelfRibbon bookId={book.id} status={state?.status ?? null} title={book.title} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-snug md:text-[16px]">
          <Link href={href} className="hover:underline">
            <span className="text-muted">{rank}. </span>
            {book.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">
          {[book.authorName, book.year, book.pages ? `${book.pages} pages` : null].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <RatingInline avg={book.ratingAvg} count={book.ratingCount} size="md" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <RateButton bookId={book.id} title={book.title} current={state?.rating ?? null} />
        <Link href={href} aria-label={`More about ${book.title}`} title="Title info"
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-cobalt hover:bg-cobalt-soft">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </li>
  );
}

/** Dense one-line row for the compact view. */
export function ChartCompactRow({ book, rank, movement }: RowProps) {
  return (
    <li className="flex items-baseline gap-3 border-b border-hair py-2 text-[14px]">
      <span className="w-10 shrink-0 text-right tabular-nums text-muted">{rank}</span>
      {movement && (
        <span className="w-9 shrink-0"><RankDelta rank={book.popularityRank} prev={book.prevPopularityRank} /></span>
      )}
      <Link href={`/book/${book.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{book.title}</Link>
      <span className="hidden truncate text-muted sm:block sm:max-w-[30%]">{book.authorName}</span>
      <span className="w-14 shrink-0 text-right tabular-nums text-ink-2">{book.ratingAvg?.toFixed(1) ?? "–"}</span>
    </li>
  );
}
