import Link from "next/link";
import type { BookCard as Card, UserBookState } from "@/lib/queries/books";
import type { AuthorTile, FeaturedList, GenreTile, LatestReview } from "@/lib/queries/home";
import { BookCard } from "@/components/book/BookCard";
import { BookCover } from "@/components/book/BookCover";
import { RankDelta, RatingInline, StarIcon } from "@/components/book/Rating";
import { RateButton } from "@/components/book/RateButton";
import { Rail } from "@/components/ui/Rail";
import { Avatar } from "@/components/ui/Avatar";
import { authorPhotoSrc } from "@/lib/covers";
import { timeAgo } from "@/lib/util";

/** Section title with a scroll-driven mask-slide reveal (CSS only). */
export function HomeHeading({ title, href, subtitle, kanji }: { title: string; href?: string; subtitle?: string; kanji?: string }) {
  const inner = (
    <>
      <span>{title}</span>
      {href && (
        <svg viewBox="0 0 12 24" className="h-5 w-2.5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2 4l8 8-8 8" />
        </svg>
      )}
    </>
  );
  return (
    <div className="mb-4">
      {kanji && <p className="home-reveal lbl mb-2 font-jp text-cobalt"><span className="block">{kanji}</span></p>}
      <h3 className="home-reveal sec-title">
        <span className="block">
          {href ? <Link href={href} className="group inline-flex items-center gap-3 hover:text-cobalt">{inner}</Link> : <span className="inline-flex items-center gap-3">{inner}</span>}
        </span>
      </h3>
      {subtitle && <p className="mt-1.5 pl-4 text-[15px] text-muted">{subtitle}</p>}
    </div>
  );
}

/** IMDb's large group heading ("What to watch" → "What to read"). */
export function GroupHeading({ title, kanji }: { title: string; kanji: string }) {
  return (
    <div className="home-reveal flex items-end justify-between border-b border-rule pb-3">
      <h2 className="block text-[clamp(28px,3.2vw,40px)] font-semibold leading-none tracking-[-0.02em] text-cobalt">{title}</h2>
      <span className="lbl block font-jp text-cobalt">{kanji}</span>
    </div>
  );
}

export function BookRail({ label, books, states, ranks }: { label: string; books: Card[]; states: Record<string, UserBookState>; ranks?: boolean }) {
  return (
    <Rail label={label}>
      {books.map((b, i) => (
        <div role="listitem" key={b.id}>
          <BookCard book={b} state={states[b.id]} rank={ranks ? i + 1 : undefined} width={168} />
        </div>
      ))}
    </Rail>
  );
}

export function PromptCard({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-hair bg-card px-6 py-10 text-center">
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-cobalt" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-md text-[15px] text-muted">{body}</p>
      <Link href={href} className="btn btn-primary mt-2">{cta}</Link>
    </div>
  );
}

/** Top 10 this week: big outlined rank numerals + movement, IMDb's top-10 rail. */
export function TrendingRail({ books, states }: { books: Card[]; states: Record<string, UserBookState> }) {
  return (
    <Rail label="Trending this week">
      {books.map((b, i) => (
        <div role="listitem" key={b.id} className="flex items-end gap-1">
          <span
            aria-hidden
            className="select-none pb-28 text-[84px] font-semibold leading-none tracking-[-0.06em] text-transparent [-webkit-text-stroke:1.5px_var(--cobalt)]"
          >
            {i + 1}
          </span>
          <div className="flex flex-col gap-1.5">
            <BookCard book={b} state={states[b.id]} width={152} showAction={false} />
            <div className="flex items-center gap-2 px-1 text-[12px] text-muted">
              <span className="lbl text-[9.5px]">BookMeter #{b.popularityRank}</span>
              <RankDelta rank={b.popularityRank} prev={b.prevPopularityRank} />
            </div>
          </div>
        </div>
      ))}
    </Rail>
  );
}

export function GenreTiles({ genres }: { genres: GenreTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {genres.map((g) => (
        <Link key={g.slug} href={`/genre/${g.slug}`}
          className="group relative flex h-[132px] flex-col overflow-hidden border border-hair bg-card p-4 transition-colors hover:border-cobalt">
          <span aria-hidden className="home-ht pointer-events-none absolute right-3 top-2.5 whitespace-nowrap transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-1.5"
            style={{ fontSize: `min(${Math.round(128 / Math.max(2, (g.kanji ?? "").length))}px, ${Math.round(40 / Math.max(2, (g.kanji ?? "").length))}vw)` }}>
            {g.kanji}
          </span>
          <span className="relative mt-auto flex flex-col gap-1.5">
            <span className="text-[19px] font-semibold leading-tight tracking-[-0.01em] group-hover:text-cobalt">{g.name}</span>
            <span className="lbl text-cobalt">{g.count} books</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function lifespan(a: AuthorTile): string | null {
  const y = (s: string | null) => s?.match(/\d{4}/)?.[0] ?? null;
  const b = y(a.birthDate), d = y(a.deathDate);
  if (!b) return null;
  return d ? `${b}–${d}` : `b. ${b}`;
}

export function AuthorRail({ authors }: { authors: AuthorTile[] }) {
  return (
    <Rail label="Authors">
      {authors.map((a) => {
        const src = authorPhotoSrc(a, "M");
        const initials = a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("");
        return (
          <div role="listitem" key={a.id} className="w-[150px]">
            <Link href={`/author/${a.id}`} className="group flex flex-col items-center text-center">
              <span className="relative block h-[132px] w-[132px] overflow-hidden rounded-full border border-hair bg-cobalt-soft">
                <span aria-hidden className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-cobalt">{initials}</span>
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale-[.2] transition-transform duration-500 group-hover:scale-105" />
                )}
              </span>
              <span className="mt-3 text-[15px] font-semibold leading-tight group-hover:underline">{a.name}</span>
              {lifespan(a) && <span className="mt-0.5 text-[13px] text-muted">{lifespan(a)}</span>}
              {a.knownFor && <span className="mt-0.5 line-clamp-1 text-[12.5px] italic text-muted">{a.knownFor}</span>}
            </Link>
          </div>
        );
      })}
    </Rail>
  );
}

export function ListTiles({ lists }: { lists: FeaturedList[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((l) => (
        <Link key={l.id} href={`/list/${l.id}`} className="group flex gap-4 border border-hair bg-card p-4 transition-colors hover:border-cobalt">
          <div className="relative h-[108px] w-[104px] shrink-0">
            {l.covers.slice(0, 3).map((c, i) => (
              <div key={c.id} className="absolute top-0 w-[68px] shadow-card transition-transform duration-500 group-hover:-translate-y-1"
                style={{ left: i * 18, zIndex: 3 - i, transform: `rotate(${(i - 1) * 4}deg)` }}>
                <BookCover book={c} size="M" />
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <p className="lbl text-cobalt">{l.count} books · {l.likes} likes</p>
            <p className="mt-1.5 line-clamp-2 text-[17px] font-semibold leading-snug group-hover:text-cobalt">{l.title}</p>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{l.description}</p>
            <p className="mt-1.5 text-[12px] text-muted">by {l.ownerName}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ReviewCards({ reviews }: { reviews: LatestReview[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {reviews.map((r) => (
        <article key={r.id} className="flex flex-col border border-hair bg-card p-5">
          <div className="flex gap-3">
            <Link href={`/book/${r.bookId}`} className="w-[52px] shrink-0"><BookCover book={{ id: r.bookId, title: r.bookTitle, coverId: r.coverId, coverUrl: r.coverUrl }} size="S" /></Link>
            <div className="min-w-0">
              <Link href={`/book/${r.bookId}`} className="line-clamp-1 font-semibold hover:underline">{r.bookTitle}</Link>
              {r.year && <p className="text-[12.5px] text-muted">{r.year}</p>}
              {r.score && (
                <p className="mt-1 inline-flex items-center gap-1 text-[13px]">
                  <StarIcon className="h-3.5 w-3.5 text-star" /><span className="font-semibold">{r.score}</span><span className="text-muted">/10</span>
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 text-[16px] font-semibold leading-snug">{r.headline}</p>
          <p className="prose-serif mt-2 line-clamp-5 !text-[15px] text-ink-2">{r.body}</p>
          <div className="mt-auto flex items-center gap-2 pt-4 text-[12.5px] text-muted">
            <Avatar name={r.displayName} hue={r.avatarHue} size={24} />
            <Link href={`/user/${r.username}`} className="font-semibold text-ink hover:underline">{r.displayName}</Link>
            <span>· {timeAgo(r.createdAt)}</span>
            {r.helpful > 0 && <span className="ml-auto">{r.helpful} found helpful</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

/** Compact Top 250 preview (first 10 rows, two columns on desktop). */
export function TopTable({ books, states }: { books: Card[]; states: Record<string, UserBookState> }) {
  return (
    <ol className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
      {books.map((b, i) => (
        <li key={b.id} className="flex items-center gap-4 border-b border-hair py-3">
          <span className="w-7 shrink-0 text-right text-[22px] font-semibold tracking-tight text-cobalt">{i + 1}</span>
          <div className="relative w-[46px] shrink-0">
            <Link href={`/book/${b.id}`} tabIndex={-1} aria-hidden><BookCover book={b} size="S" /></Link>
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/book/${b.id}`} className="line-clamp-1 font-semibold hover:underline">{b.title}</Link>
            <p className="truncate text-[13px] text-muted">{[b.year, b.authorName].filter(Boolean).join(" · ")}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <RatingInline avg={b.ratingAvg} count={b.ratingCount} />
              <RateButton bookId={b.id} title={b.title} current={states[b.id]?.rating ?? null} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
