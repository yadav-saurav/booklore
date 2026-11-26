import Link from "next/link";
import type { BookCard as Card, UserBookState } from "@/lib/queries/books";
import { BookCover } from "./BookCover";
import { RatingInline } from "./Rating";
import { RateButton } from "./RateButton";
import { ShelfRibbon } from "./ShelfRibbon";

/**
 * Poster card (IMDb "title card"): cover + ribbon, rating row with Rate star, title, author,
 * and a full-width "Want to Read" action. Fixed width so rails line up.
 */
export function BookCard({ book, state, rank, width = 176, showAction = true }: {
  book: Card; state?: UserBookState; rank?: number; width?: number; showAction?: boolean;
}) {
  const href = `/book/${book.id}`;
  const status = state?.status ?? null;
  return (
    <article className="group/card flex flex-col bg-card shadow-[0_1px_0_var(--hair)]" style={{ width }}>
      <div className="relative">
        <Link href={href} className="block" tabIndex={-1} aria-hidden>
          <BookCover book={book} className="transition-[filter] duration-300 group-hover/card:brightness-[.92]" />
        </Link>
        <ShelfRibbon bookId={book.id} status={status} title={book.title} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2.5 pt-2">
        <div className="flex items-center justify-between">
          <RatingInline avg={book.ratingAvg} count={book.ratingCount} />
          <RateButton bookId={book.id} title={book.title} current={state?.rating ?? null} />
        </div>
        <Link href={href} className="line-clamp-2 min-h-[2.5em] text-[15px] font-semibold leading-tight hover:underline">
          {rank ? <span className="text-muted">{rank}. </span> : null}
          {book.title}
        </Link>
        <p className="truncate text-[12.5px] text-muted">
          {book.authorName ?? "Unknown author"}
          {book.year ? ` · ${book.year}` : ""}
        </p>
        {showAction && (
          <div className="mt-auto pt-1.5">
            <Link href={href} className={`btn btn-sm w-full ${status ? "btn-outline" : "bg-hair-2 text-cobalt hover:bg-cobalt-soft"}`}>
              {status === "want" ? "✓ Want to Read" : status === "reading" ? "Reading" : status === "read" ? "✓ Read" : "+ Want to Read"}
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

/** Compact horizontal row (search results, charts on mobile, sidebars). */
export function BookRow({ book, meta, children }: { book: Card; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <Link href={`/book/${book.id}`} className="w-[60px] shrink-0">
        <BookCover book={book} size="S" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/book/${book.id}`} className="font-semibold leading-snug hover:underline">{book.title}</Link>
        <p className="text-[13px] text-muted">
          {book.authorName}
          {book.year ? ` · ${book.year}` : ""}
          {book.pages ? ` · ${book.pages} pages` : ""}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <RatingInline avg={book.ratingAvg} count={book.ratingCount} />
          {meta}
        </div>
        {children}
      </div>
    </div>
  );
}
