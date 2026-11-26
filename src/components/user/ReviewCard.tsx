import Link from "next/link";
import type { ReviewItem } from "@/lib/queries/users";
import { Avatar } from "@/components/ui/Avatar";
import { BookCover } from "@/components/book/BookCover";
import { StarIcon } from "@/components/book/Rating";
import { timeAgo } from "@/lib/util";

/** Review card: reviewer, the book they reviewed (links to the title page), headline and excerpt. */
export function ReviewCard({ review, showBook = true }: { review: ReviewItem; showBook?: boolean }) {
  const excerpt = review.body.length > 320 ? `${review.body.slice(0, 320).trimEnd()}…` : review.body;
  return (
    <article className="flex gap-4 border-t border-hair py-6 first:border-t-0 first:pt-0">
      {showBook && (
        <Link href={`/book/${review.book.id}`} className="hidden w-[64px] shrink-0 sm:block" tabIndex={-1} aria-hidden>
          <BookCover book={review.book} size="S" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {showBook && (
          <p className="text-[13.5px] text-muted">
            Review of{" "}
            <Link href={`/book/${review.book.id}`} className="font-semibold text-ink hover:text-cobalt hover:underline">{review.book.title}</Link>
            {review.book.year ? ` (${review.book.year})` : ""}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {review.reviewerRating !== null && (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold">
              <StarIcon className="h-3.5 w-3.5 text-star" />{review.reviewerRating}<span className="text-muted">/10</span>
            </span>
          )}
          <h3 className="text-[17px] font-semibold leading-snug">
            <Link href={`/book/${review.book.id}`} className="hover:text-cobalt">{review.headline}</Link>
          </h3>
        </div>
        {review.spoiler ? (
          <details className="mt-2 text-[15px] text-ink-2">
            <summary className="lbl inline-flex cursor-pointer items-center gap-2 text-vermilion">Contains spoilers · show</summary>
            <p className="prose-serif mt-2">{review.body}</p>
          </details>
        ) : (
          <p className="prose-serif mt-2 text-ink-2">{excerpt}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <Link href={`/user/${review.username}`} className="inline-flex items-center gap-2 font-semibold text-ink hover:text-cobalt">
            <Avatar name={review.displayName} hue={review.avatarHue} size={22} />
            {review.username}
          </Link>
          <span aria-hidden>·</span>
          <span>{timeAgo(review.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{review.helpfulCount.toLocaleString("en-US")} found this helpful</span>
        </div>
      </div>
    </article>
  );
}
