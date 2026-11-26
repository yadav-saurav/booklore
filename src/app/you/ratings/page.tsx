import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getGenres } from "@/lib/queries/books";
import { getUserRatings, ratingHistogram, RATING_SORTS, type RatingSort } from "@/lib/queries/users";
import { SectionHeader } from "@/components/ui/Section";
import { BookCover } from "@/components/book/BookCover";
import { RatingInline } from "@/components/book/Rating";
import { RateButton } from "@/components/book/RateButton";
import { SignInPrompt } from "@/components/user/SignInPrompt";
import { SortToolbar } from "@/components/user/SortToolbar";
import { Histogram } from "@/components/user/Histogram";
import { plural, fmtDate } from "@/lib/util";

export const metadata: Metadata = { title: "Your Ratings" };

const SORT_OPTIONS: [string, string][] = [
  ["date", "Date rated"], ["score", "Your rating"], ["booklore", "BOOKLORE rating"], ["title", "Title"], ["year", "Year"],
];

export default async function YourRatingsPage({ searchParams }: { searchParams: Promise<{ sort?: string; genre?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="page py-14">
        <SignInPrompt next="/you/ratings" title="Your Ratings" body="Every book you have rated, in one place, with your rating distribution." />
      </div>
    );
  }

  const sort: RatingSort = sp.sort && sp.sort in RATING_SORTS ? (sp.sort as RatingSort) : "date";
  const genres = getGenres();
  const genre = genres.some((g) => g.slug === sp.genre) ? sp.genre! : "";
  const rows = getUserRatings(me.id, { sort, genre: genre || null });
  const hist = ratingHistogram(me.id, genre || null);
  const total = hist.reduce((s, h) => s + h.count, 0);
  const mean = total ? hist.reduce((s, h) => s + h.score * h.count, 0) / total : null;

  return (
    <div className="page py-10 md:py-14">
      <SectionHeader as="h1" kanji="あなたの評価 · Your ratings" title="Your Ratings"
        subtitle="Every book you have rated, sorted however you like. Click a star to change a rating." />

      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:gap-12">
        <div>
          <SortToolbar
            sort={sort} sortOptions={SORT_OPTIONS} genre={genre}
            genreOptions={[["", "All genres"], ...genres.map((g) => [g.slug, g.name] as [string, string])]}
            params={{ sort: sort === "date" ? undefined : sort, genre: genre || undefined }}
          />
          <p className="mb-2 mt-4 text-[15px] text-ink-2" aria-live="polite">
            <span className="font-semibold text-ink">{plural(rows.length, "rating")}</span>
          </p>

          {rows.length === 0 ? (
            <div className="py-20 text-center">
              <p className="lbl font-jp text-cobalt">評価なし</p>
              <p className="mt-3 text-lg font-semibold">No ratings{genre ? " in this genre" : ""} yet.</p>
              <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">Rate a book from any cover or title page and it will appear here.</p>
              <Link href="/chart/top" className="btn btn-outline mt-6">Browse the Top 250</Link>
            </div>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.id} className="flex gap-4 border-t border-hair py-4 first:border-t-0">
                  <Link href={`/book/${r.id}`} className="w-[52px] shrink-0 sm:w-[64px]" tabIndex={-1} aria-hidden>
                    <BookCover book={r} size="S" />
                  </Link>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                    <div className="min-w-0">
                      <Link href={`/book/${r.id}`} className="font-semibold leading-snug hover:text-cobalt hover:underline">{r.title}</Link>
                      <p className="text-[13px] text-muted">
                        {r.authorName ?? "Unknown author"}{r.year ? ` · ${r.year}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                        <RatingInline avg={r.ratingAvg} count={r.ratingCount} />
                        <span className="text-muted">Rated {fmtDate(r.ratedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="lbl text-muted sm:hidden">Your rating</span>
                      <RateButton bookId={r.id} title={r.title} current={r.yourRating} />
                      <span className="text-[15px] font-semibold tabular-nums">{r.yourRating}<span className="text-[12px] font-normal text-muted">/10</span></span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="h-fit border border-hair bg-sheet p-6 md:sticky md:top-24" aria-label="Rating distribution">
          <p className="lbl mb-5 text-cobalt">Distribution{genre ? ` · ${genres.find((g) => g.slug === genre)?.name}` : ""}</p>
          <Histogram data={hist} caption={total ? `${plural(total, "rating")} · average ${mean!.toFixed(1)}` : "No ratings to chart yet."} />
        </aside>
      </div>
    </div>
  );
}
