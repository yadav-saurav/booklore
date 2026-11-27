"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookCover } from "@/components/book/BookCover";
import { StarIcon } from "@/components/book/Rating";
import { fmtRating, compact } from "@/lib/util";

type Info = {
  id: string; title: string; year: number | null; pages: number | null; coverId: number | null; coverUrl: string | null;
  authorName: string | null; synopsis: string | null; ratingAvg: number | null; ratingCount: number;
};

/** ⓘ quick view (IMDb's title info popover): cover, meta, synopsis, and links. */
export function InfoButton({ book }: { book: Info }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`More information about ${book.title}`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-cobalt transition-colors hover:bg-cobalt-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" strokeLinecap="round" strokeWidth="2" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label={`${book.title} quick view`}
          className="absolute right-0 top-full z-40 mt-2 w-[min(360px,calc(100vw-32px))] border border-hair bg-sheet p-4 text-left shadow-card">
          <div className="flex gap-3.5">
            <div className="w-[72px] shrink-0"><BookCover book={book} size="S" /></div>
            <div className="min-w-0">
              <Link href={`/book/${book.id}`} className="font-semibold leading-snug hover:text-cobalt hover:underline">{book.title}</Link>
              <p className="mt-0.5 text-[12.5px] text-muted">{[book.year, book.pages && `${book.pages} pages`].filter(Boolean).join(" · ")}</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-[13px]">
                <StarIcon className="h-3.5 w-3.5 text-star" /><b>{fmtRating(book.ratingAvg)}</b>
                <span className="text-muted">/10{book.ratingCount ? ` (${compact(book.ratingCount)})` : ""}</span>
              </p>
              {book.authorName && <p className="mt-1 truncate text-[13px] text-ink-2">{book.authorName}</p>}
            </div>
          </div>
          {book.synopsis && <p className="prose-serif mt-3 line-clamp-5 !text-[14.5px] text-ink-2">{book.synopsis}</p>}
          <div className="mt-4 flex gap-2">
            <Link href={`/book/${book.id}`} className="btn btn-primary btn-sm flex-1">Title page</Link>
            <Link href={`/book/${book.id}/reviews`} className="btn btn-outline btn-sm flex-1">Reviews</Link>
          </div>
        </div>
      )}
    </div>
  );
}
