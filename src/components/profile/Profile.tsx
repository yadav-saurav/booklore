import "./profile.css";
import Link from "next/link";
import type { ActivityEvent, Badge, ProfileInsights, ReviewItem } from "@/lib/queries/users";
import type { ListSummary } from "@/lib/queries/lists";
import type { BookCard } from "@/lib/queries/books";
import { BookCover } from "@/components/book/BookCover";
import { StarIcon } from "@/components/book/Rating";
import { Rail } from "@/components/ui/Rail";
import { timeAgo } from "@/lib/util";

/* ───────────── Badges ───────────── */

const BADGE_ICONS: Record<Badge["key"], React.ReactNode> = {
  "top-reviewer": <path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15.4 6.8 18.1l1-5.8L3.5 8.2l5.9-.9z" />,
  ratings: <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />,
  critic: <path d="M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3" />,
  explorer: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  "list-maker": <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  early: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>,
  reader: <path d="M4 5h6a2 2 0 012 2v13a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v13a2 2 0 012-2h6z" />,
};

export function BadgeRow({ badges }: { badges: Badge[] }) {
  if (!badges.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Badges">
      {badges.map((b) => (
        <li key={b.key} title={b.detail}
          className="inline-flex items-center gap-2 rounded-full border border-cobalt/40 bg-cobalt-soft py-1.5 pl-2 pr-3.5 text-[13px] font-semibold text-cobalt">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {BADGE_ICONS[b.key]}
          </svg>
          {b.label}
          <span className="sr-only">: {b.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── Rails ───────────── */

/** Cover rail; an optional blue-star overlay shows the member's own score. */
export function CoverRail({ label, books, score }: { label: string; books: BookCard[]; score?: (b: BookCard) => number | null }) {
  return (
    <Rail label={label}>
      {books.map((b) => {
        const s = score?.(b) ?? null;
        return (
          <div role="listitem" key={b.id} className="w-[132px] shrink-0">
            <Link href={`/book/${b.id}`} className="group block">
              <div className="relative shadow-card">
                <BookCover book={b} size="M" className="transition-transform duration-500 group-hover:-translate-y-0.5" />
                {s !== null && (
                  <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 bg-sheet/95 px-1.5 py-0.5 text-[12.5px] font-semibold text-ink">
                    <StarIcon className="h-3.5 w-3.5 text-cobalt" />{s}
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-[13.5px] font-semibold leading-snug group-hover:underline">{b.title}</p>
              {b.year && <p className="text-[12.5px] text-muted">{b.year}</p>}
            </Link>
          </div>
        );
      })}
    </Rail>
  );
}

export function ProgressRail({ items }: { items: (BookCard & { progress: number | null })[] }) {
  return (
    <Rail label="Continue reading">
      {items.map((b) => {
        const pct = b.progress && b.pages ? Math.min(100, Math.round((b.progress / b.pages) * 100)) : null;
        return (
          <div role="listitem" key={b.id} className="w-[132px] shrink-0">
            <Link href={`/book/${b.id}`} className="group block">
              <BookCover book={b} size="M" className="shadow-card" />
              <div className="mt-2 h-1 w-full bg-hair" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0} aria-label={`${b.title} progress`}>
                <div className="h-full bg-cobalt" style={{ width: `${pct ?? 0}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] text-muted">{pct !== null ? `${pct}% · p. ${b.progress} of ${b.pages}` : "Started"}</p>
              <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug group-hover:underline">{b.title}</p>
            </Link>
          </div>
        );
      })}
    </Rail>
  );
}

/* ───────────── Lists & reviews ───────────── */

export function MosaicListCard({ list }: { list: ListSummary }) {
  const tiles = Array.from({ length: 4 }, (_, i) => list.covers[i] ?? null);
  return (
    <Link href={`/list/${list.id}`} className="group flex flex-col border border-hair bg-card transition-colors hover:border-cobalt">
      <div className="grid grid-cols-4 gap-px bg-hair">
        {tiles.map((c, i) => c ? <BookCover key={c.id} book={c} size="S" /> : <div key={i} className="aspect-[2/3] bg-hair-2" />)}
      </div>
      <div className="p-4">
        <p className="line-clamp-2 text-[16px] font-semibold leading-snug group-hover:text-cobalt">{list.title}</p>
        <p className="mt-1 text-[13px] text-muted">
          {list.itemCount} {list.itemCount === 1 ? "book" : "books"}
          {!list.isPublic && " · Private"}
          {list.likeCount > 0 && ` · ${list.likeCount} likes`}
        </p>
      </div>
    </Link>
  );
}

export function ProfileReviewCard({ r }: { r: ReviewItem }) {
  return (
    <article className="flex min-w-0 gap-4 border border-hair bg-card p-5">
      <Link href={`/book/${r.book.id}`} className="w-[64px] shrink-0" aria-label={r.book.title}><BookCover book={r.book} size="S" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {r.reviewerRating !== null && (
            <span className="inline-flex items-center gap-1 text-[14px] font-semibold">
              <StarIcon className="h-4 w-4 text-cobalt" />{r.reviewerRating}<span className="font-normal text-muted">/10</span>
            </span>
          )}
          <Link href={`/book/${r.book.id}`} className="truncate text-[13px] text-muted hover:underline">{r.book.title}{r.book.year ? ` (${r.book.year})` : ""}</Link>
        </div>
        <p className="mt-1.5 text-[16.5px] font-semibold leading-snug">{r.headline}</p>
        {r.spoiler ? (
          <p className="mt-1.5 text-[13px] font-semibold text-vermilion">Contains spoilers</p>
        ) : (
          <p className="prose-serif mt-1.5 line-clamp-3 !text-[15px] text-ink-2">{r.body}</p>
        )}
        <p className="mt-3 text-[12.5px] text-muted">
          {timeAgo(r.createdAt)}
          {r.helpfulCount > 0 && ` · ${r.helpfulCount} ${r.helpfulCount === 1 ? "person" : "people"} found this helpful`}
        </p>
      </div>
    </article>
  );
}

/* ───────────── Insights sidebar ───────────── */

function Bar({ label, value, max, suffix, href }: { label: string; value: number; max: number; suffix: string; href?: string }) {
  const w = max ? Math.max(2, (value / max) * 100) : 0;
  const lbl = href ? <Link href={href} className="hover:underline">{label}</Link> : label;
  return (
    <li className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-[13px]">
      <span className="truncate">{lbl}</span>
      <span className="h-2 bg-hair"><span className="block h-full bg-cobalt" style={{ width: `${w}%` }} /></span>
      <span className="w-10 text-right tabular-nums text-muted">{suffix}</span>
    </li>
  );
}

export function Insights({ data }: { data: ProfileInsights }) {
  const hmax = Math.max(1, ...data.histogram.map((h) => h.count));
  const dmax = Math.max(1, ...data.decades.map((d) => d.count));
  const gmax = Math.max(1, ...data.genres.map((g) => g.pct));
  return (
    <aside aria-labelledby="insights-h" className="border border-hair bg-card p-5">
      <h2 id="insights-h" className="sec-title !text-[22px]">Insights</h2>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-b border-hair pb-5 text-center">
        <div><dt className="lbl text-[9.5px] text-muted">Ratings</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{data.ratings.toLocaleString("en-US")}</dd></div>
        <div><dt className="lbl text-[9.5px] text-muted">Average</dt><dd className="mt-1 inline-flex items-center gap-1 text-[22px] font-semibold tabular-nums"><StarIcon className="h-4 w-4 text-cobalt" />{data.average?.toFixed(1) ?? "–"}</dd></div>
        <div><dt className="lbl text-[9.5px] text-muted">Pages read</dt><dd className="mt-1 text-[22px] font-semibold tabular-nums">{data.pagesRead >= 10000 ? `${(data.pagesRead / 1000).toFixed(0)}k` : data.pagesRead.toLocaleString("en-US")}</dd></div>
      </dl>

      <h3 className="lbl mt-5 text-cobalt">Rating distribution</h3>
      <div className="mt-3 flex h-28 items-end gap-1" role="img"
        aria-label={`Ratings by score: ${data.histogram.map((h) => `${h.score}: ${h.count}`).join(", ")}`}>
        {data.histogram.map((h) => (
          <div key={h.score} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-muted">{h.count || ""}</span>
            <span className="w-full bg-cobalt" style={{ height: `${(h.count / hmax) * 100}%`, minHeight: h.count ? 2 : 0, opacity: 0.35 + (h.score / 10) * 0.65 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-rule pt-1">
        {data.histogram.map((h) => <span key={h.score} className="flex-1 text-center text-[11px] tabular-nums text-muted">{h.score}</span>)}
      </div>

      {data.genres.length > 0 && (
        <>
          <h3 className="lbl mt-6 text-cobalt">Top genres</h3>
          <ul className="mt-3 grid gap-2">
            {data.genres.map((g) => <Bar key={g.slug} label={g.name} value={g.pct} max={gmax} suffix={`${g.pct}%`} href={`/genre/${g.slug}`} />)}
          </ul>
        </>
      )}

      {data.decades.length > 0 && (
        <>
          <h3 className="lbl mt-6 text-cobalt">Books by decade</h3>
          <ul className="mt-3 grid gap-2">
            {data.decades.map((d) => <Bar key={d.decade} label={d.decade === 0 ? "Before 1900" : `${d.decade}s`} value={d.count} max={dmax} suffix={String(d.count)} />)}
          </ul>
        </>
      )}
      <p className="mt-6 border-t border-hair pt-4 text-[13px] text-muted">{data.booksRead.toLocaleString("en-US")} books marked read</p>
    </aside>
  );
}

/* ───────────── /you pieces ───────────── */

export function QuickTiles({ tiles }: { tiles: { label: string; kanji: string; href: string; count: number | null }[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <li key={t.href}>
          <Link href={t.href} className="group relative flex h-[112px] flex-col justify-between overflow-hidden border border-hair bg-card p-4 transition-colors hover:border-cobalt">
            <span aria-hidden className="pf-ht pointer-events-none absolute right-3 top-2 text-[44px]">{t.kanji}</span>
            <span className="relative text-[28px] font-semibold leading-none tabular-nums text-cobalt">{t.count ?? "→"}</span>
            <span className="relative text-[15px] font-semibold group-hover:text-cobalt">{t.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function eventText(e: ActivityEvent) {
  switch (e.kind) {
    case "rated": return <>Rated <b>{e.title}</b> <span className="inline-flex items-center gap-0.5 font-semibold text-cobalt"><StarIcon className="h-3.5 w-3.5" />{e.score}</span></>;
    case "want": return <>Added <b>{e.title}</b> to the Reading List</>;
    case "reading": return <>Started reading <b>{e.title}</b></>;
    case "read": return <>Finished <b>{e.title}</b></>;
    case "reviewed": return <>Reviewed <b>{e.title}</b></>;
    case "list": return <>Created the list <b>{e.title}</b></>;
  }
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <p className="text-[15px] text-muted">No activity yet. Rate a book to get started.</p>;
  return (
    <ol className="relative border-l border-rule pl-6">
      {events.map((e, i) => {
        const href = e.listId ? `/list/${e.listId}` : `/book/${e.bookId}`;
        return (
          <li key={i} className="relative flex items-center gap-3 py-2.5">
            <span aria-hidden className="absolute -left-[29px] h-2.5 w-2.5 rounded-full border-2 border-paper bg-cobalt" />
            {e.bookId ? (
              <Link href={href} className="w-[30px] shrink-0" tabIndex={-1} aria-hidden><BookCover book={{ id: e.bookId, title: e.title, coverId: e.coverId, coverUrl: e.coverUrl }} size="S" /></Link>
            ) : (
              <span aria-hidden className="flex h-[45px] w-[30px] shrink-0 items-center justify-center border border-hair font-jp text-[12px] text-cobalt">表</span>
            )}
            <Link href={href} className="min-w-0 flex-1 text-[14.5px] leading-snug [&_b]:font-semibold hover:[&_b]:underline">{eventText(e)}</Link>
            <span className="shrink-0 text-[12.5px] text-muted">{timeAgo(e.ts)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyNote({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="border border-dashed border-hair px-5 py-8 text-center text-[15px] text-muted">
      {children}
      {href && cta && <div><Link href={href} className="btn btn-outline btn-sm mt-4">{cta}</Link></div>}
    </div>
  );
}
