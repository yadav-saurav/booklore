import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import type { BookDetail } from "@/lib/queries/book-page";

/** IMDb subpage header: small poster, title + year, page heading, back link. */
export function SubpageHeader({ book, heading, kanji }: { book: BookDetail; heading: string; kanji?: string }) {
  return (
    <header className="border-b border-hair bg-sheet">
      <div className="page flex items-end gap-4 py-6 md:gap-5 md:py-8">
        <Link href={`/book/${book.id}`} className="w-[64px] shrink-0 shadow-card md:w-[76px]" aria-label={`Back to ${book.title}`}>
          <BookCover book={book} size="S" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/book/${book.id}`} className="group inline-flex max-w-full items-baseline gap-2 text-[15px] md:text-[17px]">
            <span className="truncate font-semibold group-hover:text-cobalt group-hover:underline">{book.title}</span>
            {book.year && <span className="shrink-0 text-muted">({book.year})</span>}
          </Link>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.02em] md:text-[40px]">{heading}</h1>
        </div>
        {kanji && <span className="hidden font-jp text-[56px] font-extrabold leading-none text-cobalt/15 md:block" aria-hidden>{kanji}</span>}
      </div>
    </header>
  );
}
