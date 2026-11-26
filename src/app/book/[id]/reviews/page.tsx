import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBookDetail, getMyReview, getRatingStats, getReviewRatingCounts, getReviews, getViewerState, type ReviewSort } from "@/lib/queries/book-page";
import { SubpageHeader } from "@/components/book-page/SubpageHeader";
import { ReviewCard } from "@/components/book-page/ReviewCard";
import { ReviewComposer } from "@/components/book-page/ReviewComposer";
import { ReviewsToolbar } from "@/components/book-page/ReviewsToolbar";
import { RatingHistogram } from "@/components/book-page/RatingHistogram";
import { BookCover } from "@/components/book/BookCover";
import { fmtRating, plural } from "@/lib/util";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const PER_PAGE = 10;
const SORTS: ReviewSort[] = ["helpful", "date", "rating-high", "rating-low"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const decode = (id: string) => { try { return decodeURIComponent(id); } catch { return id; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBookDetail(decode((await params).id));
  return { title: b ? `${b.title}: User reviews` : "Reviews" };
}

export default async function ReviewsPage({ params, searchParams }: Props) {
  const id = decode((await params).id);
  if (id.includes(":")) redirect(`/book/${encodeURIComponent(id)}`);
  const book = await getBookDetail(id);
  if (!book) notFound();
  const sp = await searchParams;
  const sort = (SORTS as string[]).includes(one(sp.sort) ?? "") ? (one(sp.sort) as ReviewSort) : "helpful";
  const r = Number(one(sp.rating));
  const rating = Number.isInteger(r) && r >= 1 && r <= 10 ? r : null;
  const hideSpoilers = one(sp.spoilers) === "hide";
  const page = Math.max(1, Math.min(50, Number(one(sp.page)) || 1));
  const write = one(sp.write) === "1";

  const user = await getCurrentUser();
  const viewer = await getViewerState(user?.id, id);
  const mine = await getMyReview(id, user?.id);
  const { items, total } = await getReviews(id, { sort, rating, hideSpoilers, limit: page * PER_PAGE, viewerId: user?.id });
  const ratingCounts = await getReviewRatingCounts(id);
  const stats = await getRatingStats(id);
  const others = items.filter((x) => !x.mine || !!rating || hideSpoilers);

  const nextParams = new URLSearchParams();
  if (sort !== "helpful") nextParams.set("sort", sort);
  if (rating) nextParams.set("rating", String(rating));
  if (hideSpoilers) nextParams.set("spoilers", "hide");
  nextParams.set("page", String(page + 1));

  return (
    <>
      <SubpageHeader book={book} heading="User reviews" kanji="評" />
      <div className="page grid gap-x-12 pb-16 pt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hair pb-5">
            <ReviewsToolbar sort={sort} rating={rating} hideSpoilers={hideSpoilers} ratingCounts={ratingCounts} />
            <ReviewComposer bookId={id} title={book.title} existing={mine} currentRating={viewer.rating} signedIn={!!user} initialOpen={write} />
          </div>

          <p className="mt-5 text-[14px] text-muted" aria-live="polite">
            <b className="text-ink">{plural(total, "review")}</b>
            {rating ? ` rated ${rating}/10` : ""}
            {hideSpoilers ? " · spoilers hidden" : ""}
            {(rating || hideSpoilers) && <> · <Link href={`/book/${id}/reviews`} className="font-semibold text-cobalt hover:underline">Clear filters</Link></>}
          </p>

          {mine && !rating && !hideSpoilers && (
            <div className="mt-5">
              <ReviewCard review={mine} label="Your review" editHref={`/book/${id}/reviews?write=1`} />
            </div>
          )}

          {others.length ? (
            <ul className="mt-5 flex flex-col gap-4">
              {others.map((rv) => (
                <li key={rv.id}><ReviewCard review={rv} editHref={`/book/${id}/reviews?write=1`} /></li>
              ))}
            </ul>
          ) : !mine || rating || hideSpoilers ? (
            <div className="mt-6 border border-dashed border-hair px-5 py-12 text-center">
              <p className="font-semibold">{total === 0 && !rating && !hideSpoilers ? "No reviews yet" : "No reviews match these filters"}</p>
              <p className="mt-1 text-[14px] text-muted">
                {total === 0 && !rating && !hideSpoilers ? "Share what you thought and start the conversation." : "Try another rating, or show spoilers."}
              </p>
            </div>
          ) : null}

          {items.length < total && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <Link href={`/book/${id}/reviews?${nextParams}`} scroll={false} className="btn btn-outline w-full max-w-xs">
                Load {Math.min(PER_PAGE, total - items.length)} more
              </Link>
              <p className="text-[12px] text-muted">Showing {items.length} of {total.toLocaleString("en-US")}</p>
            </div>
          )}
        </div>

        <aside className="pt-10 lg:pt-6" aria-label="Rating summary">
          <div className="lg:sticky lg:top-[84px]">
            <div className="border border-hair bg-card p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 shrink-0"><BookCover book={book} size="S" /></div>
                <div>
                  <p className="lbl text-muted">Booklore rating</p>
                  <p className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-[22px] leading-none text-star">★</span>
                    <span className="text-[30px] font-semibold leading-none">{fmtRating(book.ratingAvg)}</span>
                    <span className="text-muted">/10</span>
                  </p>
                  <p className="mt-1 text-[13px] text-muted">{plural(stats.total, "rating")}</p>
                </div>
              </div>
              {stats.total > 0 && <div className="mt-5"><RatingHistogram counts={stats.counts} total={stats.total} mine={viewer.rating} /></div>}
              <Link href={`/book/${id}/ratings`} className="mt-4 inline-flex text-[14px] font-semibold text-cobalt hover:underline">Full ratings breakdown →</Link>
            </div>
            <div className="mt-4 border border-hair p-5 text-[13px] text-ink-2">
              <p className="lbl mb-2 text-muted">Review guidelines</p>
              <p>Write in your own words, flag plot reveals with the spoiler box, and keep it about the book. Reviews need at least 50 characters and a rating.</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
