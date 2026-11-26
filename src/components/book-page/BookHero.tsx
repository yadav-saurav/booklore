import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import { ShelfRibbon } from "@/components/book/ShelfRibbon";
import { RateButton } from "@/components/book/RateButton";
import { RankDelta, StarIcon } from "@/components/book/Rating";
import { AddToListButton } from "@/components/lists/AddToListButton";
import type { BookDetail, ViewerState } from "@/lib/queries/book-page";
import { compact, fmtRating } from "@/lib/util";
import { ArchiveCard } from "./ArchiveCard";
import { ShelfButton } from "./ShelfButton";
import { fmtIsbn, googleIsbnUrl, googleTitleUrl, languageName, olWorkUrl } from "./format";

function Cluster({ book, viewer, align = "end" }: { book: BookDetail; viewer: ViewerState; align?: "end" | "between" }) {
  const item = "flex flex-col items-center gap-1";
  return (
    <div className={`flex items-start ${align === "end" ? "gap-7 lg:gap-9" : "justify-around"}`}>
      <Link href={`/book/${book.id}/ratings`} className={`${item} group`}>
        <span className="lbl text-muted">Booklore rating</span>
        <span className="flex items-center gap-1.5">
          <StarIcon className="h-7 w-7 text-star" />
          <span className="leading-none">
            <span className="text-[20px] font-semibold text-ink">{fmtRating(book.ratingAvg)}</span>
            <span className="text-[14px] text-muted">/10</span>
            <span className="block text-[12px] text-muted group-hover:text-cobalt group-hover:underline">{compact(book.ratingCount)}</span>
          </span>
        </span>
      </Link>
      <div className={item}>
        <RateButton bookId={book.id} title={book.title} current={viewer.rating} variant="hero" />
      </div>
      <Link href="/chart/bookmeter" className={`${item} group`}>
        <span className="lbl text-muted">Popularity</span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-up text-up" aria-hidden>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5"><path d="M2 11l4-4 3 3 5-5M10 5h4v4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </span>
          <span className="text-[20px] font-semibold leading-none text-ink group-hover:underline">{book.popularityRank ? compact(book.popularityRank) : "—"}</span>
          <RankDelta rank={book.popularityRank} prev={book.prevPopularityRank} />
        </span>
      </Link>
    </div>
  );
}

function Tile({ href, label, value, children }: { href: string; label: string; value: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group relative flex flex-1 flex-col justify-between overflow-hidden border border-hair bg-card p-4 transition-colors hover:border-cobalt">
      <span className="text-cobalt" aria-hidden>{children}</span>
      <span>
        <span className="lbl block text-muted group-hover:text-cobalt">{label}</span>
        <span className="mt-1 block text-[26px] font-semibold leading-none tracking-tight">{value}</span>
      </span>
    </Link>
  );
}

const Dot = () => <span aria-hidden className="text-muted">·</span>;

export function BookHero({
  book, viewer, listMentions, topRank,
}: { book: BookDetail; viewer: ViewerState; listMentions: number; topRank: number | null }) {
  const lang = languageName(book.language);
  const age = book.year ? new Date().getFullYear() - book.year : null;
  const meta = [
    book.year && <span key="y">{book.year}</span>,
    book.pages && <span key="p">{book.pages.toLocaleString("en-US")} pages</span>,
    lang && <span key="l">{lang}</span>,
    book.year && <span key="f">First published {age && age > 1 ? `${age} years ago` : book.year}</span>,
  ].filter(Boolean);

  return (
    <section className="relative isolate overflow-hidden border-b border-hair bg-sheet" aria-labelledby="book-title">
      {/* Blurred, darkened cover backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_35%,transparent_85%)]" aria-hidden>
        <div className="absolute -inset-20 opacity-45 blur-[70px] saturate-150 brightness-75">
          <BookCover book={book} size="M" className="!aspect-auto h-full w-full" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--sheet)_55%,transparent)_0%,color-mix(in_oklab,var(--sheet)_82%,transparent)_55%,var(--sheet)_100%)]" />
      </div>

      <div className="page pb-8 pt-5 md:pb-10 md:pt-7">
        <nav className="mb-4 flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-[13px] font-semibold text-cobalt" aria-label="Book sections">
          <Link href={`/book/${book.id}/reviews`} className="hover:underline">User reviews</Link>
          <Link href={`/book/${book.id}/ratings`} className="hover:underline">Ratings</Link>
          {book.authors[0] && <Link href={`/author/${book.authors[0].id}`} className="hover:underline">Author</Link>}
          {topRank && <Link href="/chart/top" className="lbl box border-cobalt">Top 250 · #{topRank}</Link>}
        </nav>

        {/* Title row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-10">
          <div className="min-w-0">
            <h1 id="book-title" className="text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[48px]">{book.title}</h1>
            {book.subtitle && <p className="mt-1.5 font-serif text-[18px] italic text-ink-2 md:text-[20px]">{book.subtitle}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
              {meta.flatMap((m, i) => (i ? [<Dot key={`d${i}`} />, m] : [m]))}
            </p>
          </div>
          <div className="hidden shrink-0 md:block"><Cluster book={book} viewer={viewer} /></div>
        </div>

        {/* Media row (desktop) */}
        <div className="mt-6 hidden gap-2 md:grid md:h-[330px] md:grid-cols-[220px_1fr] lg:h-[372px] lg:grid-cols-[248px_1fr_200px]">
          <div className="relative h-full shadow-card">
            <BookCover book={book} size="L" priority className="h-full" />
            <ShelfRibbon bookId={book.id} status={viewer.status} title={book.title} />
          </div>
          <ArchiveCard book={book} className="h-full" />
          <div className="hidden flex-col gap-2 lg:flex">
            <Tile href={`/book/${book.id}/reviews`} label="User reviews" value={compact(book.reviewCount)}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" /><path d="M8 9h8M8 12h5" /></svg>
            </Tile>
            <Tile href={`/book/${book.id}/ratings`} label="Ratings" value={compact(book.ratingCount)}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 20V12M9 20V6M14 20v-9M19 20V9" strokeLinecap="round" /></svg>
            </Tile>
          </div>
        </div>

        {/* Mobile: cover + chips/synopsis, then rating row */}
        <div className="mt-5 md:hidden">
          <div className="flex gap-4">
            <div className="relative w-[112px] shrink-0 shadow-card">
              <BookCover book={book} size="M" priority />
              <ShelfRibbon bookId={book.id} status={viewer.status} title={book.title} />
            </div>
            <div className="min-w-0 flex-1">
              <Genres book={book} />
              {book.synopsis && <p className="prose-serif mt-3 line-clamp-6 !text-[15px] text-ink-2">{book.synopsis}</p>}
            </div>
          </div>
          <div className="mt-5 border-y border-hair py-4"><Cluster book={book} viewer={viewer} align="between" /></div>
        </div>

        {/* Below media */}
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px] lg:gap-12">
          <div className="min-w-0">
            <div className="max-md:hidden"><Genres book={book} /></div>
            {book.synopsis ? (
              <p className="prose-serif mt-4 max-w-[68ch] text-ink-2 max-md:hidden">{book.synopsis}</p>
            ) : (
              <p className="mt-4 text-[14px] text-muted max-md:hidden">No synopsis in the archive yet.</p>
            )}
            <dl className="mt-5 border-t border-hair text-[15px] max-md:mt-0">
              <CreditRow label={book.authors.length > 1 ? "Authors" : "Author"}>
                {book.authors.length ? book.authors.map((a, i) => (
                  <span key={a.id}>{i > 0 && <Dot />}{i > 0 && " "}<Link href={`/author/${a.id}`} className="text-cobalt hover:underline">{a.name}</Link>{" "}</span>
                )) : <span className="text-muted">Unknown</span>}
              </CreditRow>
              {book.publisher && <CreditRow label="Publisher">{book.publisher}</CreditRow>}
              {book.isbn13 && <CreditRow label="ISBN-13"><span className="tabular-nums">{fmtIsbn(book.isbn13)}</span></CreditRow>}
            </dl>
          </div>

          {/* CTA stack */}
          <div className="flex flex-col gap-3 max-md:order-first">
            <ShelfButton bookId={book.id} title={book.title} status={viewer.status} addedBy={book.shelfCount} />
            <AddToListButton bookId={book.id} title={book.title} className="block w-full [&>button]:h-11 [&>button]:w-full" />
            <div className="border border-hair bg-card/70 p-4">
              <p className="lbl text-muted">Where to find it</p>
              <ul className="mt-2.5 flex flex-col divide-y divide-hair text-[14px]">
                {book.olWorkKey && <ExtLink href={olWorkUrl(book.olWorkKey)} label="Open Library" sub="Borrow, editions & previews" />}
                <ExtLink href={book.isbn13 ? googleIsbnUrl(book.isbn13) : googleTitleUrl(book.title, book.authorName)} label="Google Books"
                  sub={book.isbn13 ? `Search by ISBN ${book.isbn13}` : "Search by title"} />
              </ul>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 text-[13px]">
              <Count href={`/book/${book.id}/reviews`} n={book.reviewCount} label="User reviews" />
              <Count href="/readinglist" n={book.shelfCount} label="on Reading Lists" />
              <Count href={`/book/${book.id}/ratings`} n={book.ratingCount} label="ratings" />
            </div>
            {listMentions > 0 && <p className="text-[12px] text-muted">Appears in {listMentions.toLocaleString("en-US")} user {listMentions === 1 ? "list" : "lists"}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Genres({ book }: { book: BookDetail }) {
  if (!book.genres.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Genres">
      {book.genres.map((g) => (
        <li key={g.slug}><Link href={`/genre/${g.slug}`} className="chip bg-card/60">{g.name}</Link></li>
      ))}
    </ul>
  );
}

function CreditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hair py-3">
      <dt className="w-24 shrink-0 font-semibold">{label}</dt>
      <dd className="min-w-0 text-ink-2">{children}</dd>
    </div>
  );
}

function ExtLink({ href, label, sub }: { href: string; label: string; sub: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 py-2.5">
        <span className="min-w-0">
          <span className="block font-semibold text-cobalt group-hover:underline">{label}</span>
          <span className="block truncate text-[12px] text-muted">{sub}</span>
        </span>
        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-muted group-hover:text-cobalt" aria-hidden><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </a>
    </li>
  );
}

function Count({ href, n, label }: { href: string; n: number; label: string }) {
  return (
    <Link href={href} className="group leading-tight">
      <span className="block font-semibold tabular-nums text-ink">{compact(n)}</span>
      <span className="text-cobalt group-hover:underline">{label}</span>
    </Link>
  );
}
