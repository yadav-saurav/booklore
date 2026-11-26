import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { maybeRefreshRankings, recordView } from "@/lib/aggregates";
import { resolveExternalRef } from "@/lib/catalog";
import { getSimilarBooks } from "@/lib/recommend";
import { getUserStates } from "@/lib/queries/books";
import {
  getBookDetail, getExploreGenres, getGenreRanks, getListsContaining, getMyReview, getOtherBooksByAuthor,
  getRatingStats, getReviews, getTopRank, getViewerState,
} from "@/lib/queries/book-page";
import { authorPhotoSrc } from "@/lib/covers";
import { BookCard } from "@/components/book/BookCard";
import { BookCover } from "@/components/book/BookCover";
import { Avatar } from "@/components/ui/Avatar";
import { Rail } from "@/components/ui/Rail";
import { SectionHeader } from "@/components/ui/Section";
import { BookHero } from "@/components/book-page/BookHero";
import { ReviewCard } from "@/components/book-page/ReviewCard";
import { ReviewComposer } from "@/components/book-page/ReviewComposer";
import { MiniHistogram } from "@/components/book-page/RatingHistogram";
import { fmtIsbn, languageName, lifeSpan, olWorkUrl } from "@/components/book-page/format";
import { compact, fmtRating, plural } from "@/lib/util";

type Props = { params: Promise<{ id: string }> };

const decode = (id: string) => { try { return decodeURIComponent(id); } catch { return id; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = decode((await params).id);
  if (id.includes(":")) return { title: "Opening book…" };
  const b = getBookDetail(id);
  if (!b) return { title: "Book not found" };
  const by = b.authorName ? ` by ${b.authorName}` : "";
  const desc = b.synopsis ? b.synopsis.slice(0, 180) : `${b.title}${by}: ratings, reviews and reading lists on BOOKLORE.`;
  return {
    title: `${b.title}${b.year ? ` (${b.year})` : ""}`,
    description: desc,
    openGraph: { title: `${b.title}${by}`, description: desc, type: "book" },
  };
}

export default async function BookPage({ params }: Props) {
  const id = decode((await params).id);
  if (id.includes(":")) {
    const slug = await resolveExternalRef(id);
    if (!slug) notFound();
    redirect(`/book/${slug}`);
  }
  if (!getBookDetail(id)) notFound();

  recordView(id);
  maybeRefreshRankings();
  const book = getBookDetail(id)!;
  const user = await getCurrentUser();
  const viewer = getViewerState(user?.id, id);
  const stats = getRatingStats(id);
  const { items: reviews } = getReviews(id, { sort: "helpful", limit: 9, viewerId: user?.id, hideSpoilers: false });
  const mine = getMyReview(id, user?.id);
  const similar = await getSimilarBooks(id, 12);
  const authorsMore = book.authors.slice(0, 3).map((a) => ({ author: a, books: getOtherBooksByAuthor(a.id, id, 6) }));
  const lists = getListsContaining(id, 4);
  const genreRanks = getGenreRanks(id);
  const topRank = getTopRank(id);
  const explore = getExploreGenres(book.genres.map((g) => g.slug), 6);
  const states = getUserStates(user?.id, [...similar.map((b) => b.id), ...authorsMore.flatMap((x) => x.books.map((b) => b.id))]);

  const [featured, ...rest] = reviews;
  const lang = languageName(book.language);

  return (
    <>
      <BookHero book={book} viewer={viewer} listMentions={lists.total} topRank={topRank} />

      <div className="page grid gap-x-12 pb-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* Top reviews */}
          <section className="pt-10" aria-labelledby="sec-reviews">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div id="sec-reviews"><SectionHeader title="User reviews" href={`/book/${id}/reviews`} count={book.reviewCount} /></div>
              <ReviewComposer bookId={id} title={book.title} existing={mine} currentRating={viewer.rating} signedIn={!!user} className="btn-sm" />
            </div>
            {featured ? (
              <>
                <div className="mb-4 flex items-center gap-4 text-[14px]">
                  <span className="inline-flex items-center gap-1.5"><span className="text-star">★</span><b>{fmtRating(book.ratingAvg)}</b><span className="text-muted">/10 · {plural(book.ratingCount, "rating")}</span></span>
                </div>
                <ReviewCard review={featured} variant="featured" label="Featured review" editHref={`/book/${id}/reviews?write=1`} />
                {rest.length > 0 && (
                  <div className="mt-4">
                    <Rail label="More user reviews">
                      {rest.map((r) => (
                        <div key={r.id} role="listitem" className="w-[300px] md:w-[340px]">
                          <ReviewCard review={r} variant="compact" editHref={`/book/${id}/reviews?write=1`} />
                        </div>
                      ))}
                    </Rail>
                  </div>
                )}
                <Link href={`/book/${id}/reviews`} className="mt-4 inline-flex text-[14px] font-semibold text-cobalt hover:underline">
                  See all {plural(book.reviewCount, "user review")} →
                </Link>
              </>
            ) : (
              <EmptyBox title="No reviews yet" body="Be the first to tell other readers what you thought.">
                <ReviewComposer bookId={id} title={book.title} existing={null} currentRating={viewer.rating} signedIn={!!user} variant="inline" />
              </EmptyBox>
            )}
          </section>

          {/* More like this */}
          <section className="pt-12" aria-labelledby="sec-similar">
            <div id="sec-similar"><SectionHeader title="More like this" /></div>
            {similar.length ? (
              <Rail label="More like this">
                {similar.map((b) => <div key={b.id} role="listitem"><BookCard book={b} state={states[b.id]} width={164} /></div>)}
              </Rail>
            ) : <EmptyBox title="Nothing similar yet" body="As the archive grows we'll find books that share this one's genres." />}
          </section>

          {/* About the author(s) */}
          {authorsMore.length > 0 && (
            <section className="pt-12" aria-labelledby="sec-authors">
              <div id="sec-authors"><SectionHeader title={authorsMore.length > 1 ? "About the authors" : "About the author"} /></div>
              <div className="flex flex-col gap-6">
                {authorsMore.map(({ author: a, books }) => {
                  const photo = authorPhotoSrc(a, "M");
                  const span = lifeSpan(a.birthDate, a.deathDate);
                  return (
                    <article key={a.id} className="border border-hair bg-card p-5 md:p-6">
                      <div className="flex gap-4 md:gap-5">
                        <Link href={`/author/${a.id}`} className="shrink-0">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt="" className="h-24 w-24 rounded-full bg-hair-2 object-cover md:h-28 md:w-28" loading="lazy" />
                          ) : (
                            <Avatar name={a.name} hue={Math.round((a.name.charCodeAt(0) * 37) % 360)} size={96} />
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/author/${a.id}`} className="text-[20px] font-semibold hover:text-cobalt hover:underline">{a.name}</Link>
                          <p className="mt-0.5 text-[13px] text-muted">{[span, a.nationality].filter(Boolean).join(" · ") || "Author"}</p>
                          {a.bio ? (
                            <p className="prose-serif mt-2 line-clamp-4 !text-[16px] text-ink-2">{a.bio}</p>
                          ) : (
                            <p className="mt-2 text-[14px] text-muted">No biography in the archive yet.</p>
                          )}
                          <Link href={`/author/${a.id}`} className="mt-2 inline-flex text-[14px] font-semibold text-cobalt hover:underline">Full profile →</Link>
                        </div>
                      </div>
                      {books.length > 0 && (
                        <div className="mt-5 border-t border-hair pt-4">
                          <p className="lbl mb-3 text-muted">More by {a.name}</p>
                          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                            {books.map((b) => (
                              <li key={b.id}>
                                <Link href={`/book/${b.id}`} className="group block">
                                  <BookCover book={b} size="S" className="transition-[filter] group-hover:brightness-90" />
                                  <span className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-tight group-hover:underline">{b.title}</span>
                                  <span className="text-[12px] text-muted">{b.year ?? ""}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Ratings breakdown */}
          <section className="pt-12" aria-labelledby="sec-ratings">
            <div id="sec-ratings"><SectionHeader title="Ratings breakdown" href={`/book/${id}/ratings`} /></div>
            <div className="grid gap-6 border border-hair bg-card p-5 sm:grid-cols-[180px_1fr] md:p-6">
              <div>
                <p className="lbl text-muted">Booklore rating</p>
                <p className="mt-2 flex items-baseline gap-1">
                  <span className="text-star text-[28px] leading-none">★</span>
                  <span className="text-[40px] font-semibold leading-none tracking-tight">{fmtRating(book.ratingAvg)}</span>
                  <span className="text-muted">/10</span>
                </p>
                <p className="mt-1.5 text-[13px] text-muted">{plural(stats.total, "rating")}</p>
                {viewer.rating && <p className="mt-3 text-[13px]">Your rating: <b className="text-cobalt">{viewer.rating}/10</b></p>}
              </div>
              {stats.total ? (
                <MiniHistogram counts={stats.counts} total={stats.total} href={`/book/${id}/ratings`} />
              ) : (
                <p className="self-center text-[14px] text-muted">No ratings yet. Rate it from the top of the page to start the histogram.</p>
              )}
            </div>
          </section>

          {/* Details */}
          <section className="pt-12" aria-labelledby="sec-details">
            <div id="sec-details"><SectionHeader title="Details" /></div>
            <dl className="border-t border-hair text-[15px]">
              <Detail label="First published">{book.year ?? "—"}</Detail>
              <Detail label="Pages">{book.pages ? book.pages.toLocaleString("en-US") : "—"}</Detail>
              <Detail label="Language">{lang ?? "—"}</Detail>
              <Detail label="Publisher">{book.publisher ?? "—"}</Detail>
              <Detail label="ISBN-13"><span className="tabular-nums">{fmtIsbn(book.isbn13) ?? "—"}</span></Detail>
              {book.olWorkKey && (
                <Detail label="Open Library work">
                  <a href={olWorkUrl(book.olWorkKey)} target="_blank" rel="noopener noreferrer" className="font-mono text-[14px] text-cobalt hover:underline">{book.olWorkKey} ↗</a>
                </Detail>
              )}
              {book.subjects.length > 0 && (
                <Detail label="Subjects">
                  <ul className="flex flex-wrap gap-1.5">
                    {book.subjects.slice(0, 16).map((s) => (
                      <li key={s}><Link href={`/search?q=${encodeURIComponent(s)}`} className="chip h-7 px-2.5 text-[12.5px]">{s}</Link></li>
                    ))}
                  </ul>
                </Detail>
              )}
            </dl>
            <p className="mt-3 text-[12px] text-muted">
              {book.source === "google" ? "Metadata from Google Books." : (
                <>Metadata from <a className="underline hover:text-cobalt" href={book.olWorkKey ? olWorkUrl(book.olWorkKey) : "https://openlibrary.org"} target="_blank" rel="noopener noreferrer">Open Library</a>, an Internet Archive project.</>
              )}
              {book.olRatingCount > 0 && book.olRatingAvg && ` Open Library readers rate it ${fmtRating(book.olRatingAvg)}/10 across ${compact(book.olRatingCount)} ratings.`}
            </p>
          </section>

          {/* Appears in lists */}
          <section className="pt-12" aria-labelledby="sec-lists">
            <div id="sec-lists"><SectionHeader title="Appears in lists" count={lists.total || undefined} /></div>
            {lists.items.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {lists.items.map((l) => (
                  <li key={l.id}>
                    <Link href={`/list/${l.id}`} className="group flex gap-4 border border-hair bg-card p-4 transition-colors hover:border-cobalt">
                      <span className="relative h-[84px] w-[92px] shrink-0" aria-hidden>
                        {l.coverBooks.slice(0, 3).map((b, i) => (
                          <span key={b.id} className="absolute top-0 w-[56px] shadow-card" style={{ left: i * 18, zIndex: 3 - i, top: i * 3 }}>
                            <BookCover book={b} size="S" />
                          </span>
                        ))}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-semibold leading-snug group-hover:text-cobalt group-hover:underline">{l.title}</span>
                        <span className="mt-1 block text-[13px] text-muted">by {l.ownerName} · {plural(l.itemCount, "book")}</span>
                        {l.likeCount > 0 && <span className="text-[12px] text-muted">♥ {compact(l.likeCount)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBox title="Not on any public lists yet" body="Add it to one of yours to help other readers find it." />
            )}
          </section>
        </div>

        {/* Sticky right rail */}
        <aside className="pt-12 lg:pt-10" aria-label="More to explore">
          <div className="lg:sticky lg:top-[84px]">
            <SectionHeader title="More to explore" as="h2" />
            <div className="flex flex-col gap-3">
              {genreRanks.map((g) => (
                <Link key={g.slug} href={`/genre/${g.slug}`} className="group flex items-center justify-between gap-3 border border-hair bg-card px-4 py-3.5 transition-colors hover:border-cobalt">
                  <span>
                    <span className="lbl block text-muted">Top {g.name}</span>
                    <span className="mt-1.5 block text-[15px] font-semibold group-hover:text-cobalt">
                      {g.rank ? <>#{g.rank} <span className="font-normal text-muted">of {g.total.toLocaleString("en-US")}</span></> : "See the chart"}
                    </span>
                  </span>
                  <Chevron />
                </Link>
              ))}
              <Link href="/chart/top" className="group flex items-center justify-between border border-hair bg-card px-4 py-3.5 hover:border-cobalt">
                <span>
                  <span className="lbl block text-muted">Top 250 books</span>
                  <span className="mt-1.5 block text-[15px] font-semibold group-hover:text-cobalt">{topRank ? `#${topRank} on the chart` : "Browse the chart"}</span>
                </span>
                <Chevron />
              </Link>
              <Link href="/chart/bookmeter" className="group flex items-center justify-between border border-hair bg-card px-4 py-3.5 hover:border-cobalt">
                <span>
                  <span className="lbl block text-muted">BookMeter</span>
                  <span className="mt-1.5 block text-[15px] font-semibold group-hover:text-cobalt">{book.popularityRank ? `#${book.popularityRank.toLocaleString("en-US")} most popular` : "What's trending"}</span>
                </span>
                <Chevron />
              </Link>
            </div>
            {explore.length > 0 && (
              <div className="mt-6">
                <p className="lbl mb-3 text-muted">Explore other genres</p>
                <ul className="flex flex-wrap gap-2">
                  {explore.map((g) => <li key={g.slug}><Link href={`/genre/${g.slug}`} className="chip">{g.name}</Link></li>)}
                </ul>
              </div>
            )}
            <p className="mt-8 font-jp text-[64px] font-extrabold leading-none text-cobalt/10" aria-hidden>{book.genres[0]?.kanji ?? "書庫"}</p>
          </div>
        </aside>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-hair py-3 sm:grid-cols-[170px_1fr]">
      <dt className="font-semibold">{label}</dt>
      <dd className="min-w-0 text-ink-2">{children}</dd>
    </div>
  );
}

function EmptyBox({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-hair px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-[14px] text-muted">{body}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 12 24" className="h-5 w-2.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-cobalt" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 4l8 8-8 8" />
    </svg>
  );
}
