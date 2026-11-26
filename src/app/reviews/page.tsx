import type { Metadata } from "next";
import Link from "next/link";
import { getGenres } from "@/lib/queries/books";
import { getReviews, countReviews, type ReviewSort } from "@/lib/queries/users";
import { SectionHeader } from "@/components/ui/Section";
import { SortToolbar } from "@/components/user/SortToolbar";
import { ReviewCard } from "@/components/user/ReviewCard";
import { qs } from "@/components/user/qs";
import { plural } from "@/lib/util";

export const metadata: Metadata = { title: "Latest reviews" };

const PER_PAGE = 20;
const SORT_OPTIONS: [string, string][] = [["latest", "Latest"], ["helpful", "Most helpful this month"]];

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ sort?: string; genre?: string; page?: string }> }) {
  const sp = await searchParams;
  const sort: ReviewSort = sp.sort === "helpful" ? "helpful" : "latest";
  const genres = getGenres();
  const genre = genres.some((g) => g.slug === sp.genre) ? sp.genre! : "";
  const total = countReviews({ genre: genre || null, sort });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const reviews = getReviews({ genre: genre || null, sort, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const base = { sort: sort === "latest" ? undefined : sort, genre: genre || undefined };

  return (
    <div className="page py-10 md:py-14">
      <SectionHeader as="h1" kanji="批評 · Reviews" title="Latest reviews"
        subtitle="What readers across the archive are saying right now." />

      <SortToolbar
        sort={sort} sortOptions={SORT_OPTIONS} genre={genre}
        genreOptions={[["", "All genres"], ...genres.map((g) => [g.slug, g.name] as [string, string])]}
        params={base}
      />

      <p className="mb-2 mt-5 text-[14px] text-muted" aria-live="polite">
        {plural(total, "review")}{sort === "helpful" ? " in the last 30 days" : ""}
      </p>

      {reviews.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-lg font-semibold">No reviews{genre ? " in this genre" : ""} {sort === "helpful" ? "this month" : "yet"}.</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">Open any title page and write the first one.</p>
          <Link href="/chart/top" className="btn btn-outline mt-6">Browse the Top 250</Link>
        </div>
      ) : (
        <div>{reviews.map((r) => <ReviewCard key={r.reviewId} review={r} />)}</div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-[14px]">
          {page > 1 && <Link href={`/reviews${qs({ ...base, page: String(page - 1) })}`} className="btn btn-outline btn-sm">← Newer</Link>}
          <span className="px-2 tabular-nums text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/reviews${qs({ ...base, page: String(page + 1) })}`} className="btn btn-outline btn-sm">Older →</Link>}
        </nav>
      )}
    </div>
  );
}
