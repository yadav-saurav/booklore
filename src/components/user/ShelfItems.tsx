import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import { RatingInline, StarIcon } from "@/components/book/Rating";
import { RateButton } from "@/components/book/RateButton";
import { ShelfSelect } from "./ShelfSelect";
import { ProgressForm } from "./ProgressForm";
import type { ShelfItem } from "@/lib/queries/users";
import { plural } from "@/lib/util";

/** One row of the Reading List: cover, title, author, ratings, progress and the status select. */
export function ShelfRow({ item }: { item: ShelfItem }) {
  const href = `/book/${item.id}`;
  return (
    <li className="flex gap-4 border-t border-hair py-5 first:border-t-0 first:pt-0">
      <Link href={href} className="w-[64px] shrink-0 sm:w-[84px]" tabIndex={-1} aria-hidden>
        <BookCover book={item} size="S" />
      </Link>
      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:gap-8">
        <div className="min-w-0">
          <Link href={href} className="font-semibold leading-snug hover:text-cobalt hover:underline">{item.title}</Link>
          <p className="mt-0.5 text-[13px] text-muted">
            {item.authorName ?? "Unknown author"}{item.year ? ` · ${item.year}` : ""}{item.pages ? ` · ${plural(item.pages, "page")}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <span className="flex items-center gap-1.5">
              <span className="text-muted">BOOKLORE</span>
              <RatingInline avg={item.ratingAvg} count={item.ratingCount} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted">Your rating</span>
              <RateButton bookId={item.id} title={item.title} current={item.yourRating} />
              {!item.yourRating && <span className="text-muted">not yet</span>}
            </span>
          </div>
          {item.status === "reading" && (
            <div className="mt-3">
              <ProgressForm bookId={item.id} progress={item.progress} pages={item.pages} />
            </div>
          )}
        </div>
        <div className="flex items-start md:justify-end">
          <ShelfSelect bookId={item.id} title={item.title} status={item.status} />
        </div>
      </div>
    </li>
  );
}

/** Poster tile for grid view. */
export function ShelfTile({ item }: { item: ShelfItem }) {
  const href = `/book/${item.id}`;
  const pct = item.pages && item.progress ? Math.min(100, Math.round((item.progress / item.pages) * 100)) : null;
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <Link href={href} className="block" tabIndex={-1} aria-hidden>
        <BookCover book={item} size="M" className="transition-[filter] duration-300 hover:brightness-[.92]" />
      </Link>
      <Link href={href} className="line-clamp-2 min-h-[2.5em] text-[14px] font-semibold leading-tight hover:text-cobalt hover:underline">{item.title}</Link>
      <p className="truncate text-[12.5px] text-muted">
        {item.yourRating ? (
          <span className="inline-flex items-center gap-1 text-ink-2"><StarIcon className="h-3 w-3 text-star" />{item.yourRating}/10</span>
        ) : (
          <span>{item.authorName ?? "Unknown author"}</span>
        )}
      </p>
      {pct !== null && <p className="text-[12px] tabular-nums text-muted" aria-label={`${pct}% read`}>{pct}% read</p>}
      <ShelfSelect bookId={item.id} title={item.title} status={item.status} className="w-full" />
    </li>
  );
}
