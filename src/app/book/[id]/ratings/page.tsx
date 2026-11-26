import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TOP_MIN_VOTES } from "@/lib/aggregates";
import { getBookDetail, getCatalogMean, getRatingStats, getRatingsByYear, getTopRank, getViewerState } from "@/lib/queries/book-page";
import { SubpageHeader } from "@/components/book-page/SubpageHeader";
import { RatingHistogram } from "@/components/book-page/RatingHistogram";
import { RateButton } from "@/components/book/RateButton";
import { StarIcon } from "@/components/book/Rating";
import { fmtDate, fmtRating, plural } from "@/lib/util";

type Props = { params: Promise<{ id: string }> };
const decode = (id: string) => { try { return decodeURIComponent(id); } catch { return id; } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBookDetail(decode((await params).id));
  return { title: b ? `${b.title}: Ratings` : "Ratings" };
}

const f2 = (n: number | null) => (n == null ? "–" : n.toFixed(2));

export default async function RatingsPage({ params }: Props) {
  const id = decode((await params).id);
  if (id.includes(":")) redirect(`/book/${encodeURIComponent(id)}`);
  const book = await getBookDetail(id);
  if (!book) notFound();
  const user = await getCurrentUser();
  const viewer = await getViewerState(user?.id, id);
  const stats = await getRatingStats(id);
  const years = await getRatingsByYear(id);
  const C = await getCatalogMean();
  const v = stats.total, m = TOP_MIN_VOTES, R = stats.mean;
  const wr = v && R != null ? (v / (v + m)) * R + (m / (v + m)) * C : null;
  const topRank = await getTopRank(id);
  const maxYear = Math.max(1, ...years.map((y) => y.count));

  return (
    <>
      <SubpageHeader book={book} heading="Ratings" kanji="評価" />
      <div className="page pb-16 pt-8">
        {/* Headline numbers */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border border-hair bg-card p-5 md:p-6">
            <p className="lbl text-muted">Booklore rating</p>
            <p className="mt-3 flex items-center gap-2.5">
              <StarIcon className="h-10 w-10 text-star" />
              <span className="text-[44px] font-semibold leading-none tracking-tight">{fmtRating(book.ratingAvg)}</span>
              <span className="self-end pb-1 text-[16px] text-muted">/10</span>
            </p>
            <p className="mt-2 text-[14px] text-muted">{plural(stats.total, "rating")}{topRank ? ` · #${topRank} in the Top 250` : ""}</p>
          </div>
          <div className="flex flex-col items-start justify-between border border-hair bg-card p-5 md:p-6">
            <div className="[&_button]:items-start">
              <RateButton bookId={id} title={book.title} current={viewer.rating} variant="hero" />
            </div>
            <p className="mt-3 text-[14px] text-muted">
              {viewer.rating ? `You rated this ${viewer.rating}/10${viewer.ratedAt ? ` on ${fmtDate(viewer.ratedAt)}` : ""}.` : user ? "You haven't rated this yet." : "Sign in to add your rating."}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Histogram */}
          <section aria-labelledby="h-dist">
            <h2 id="h-dist" className="sec-title mb-5">Rating distribution</h2>
            {stats.total ? (
              <RatingHistogram counts={stats.counts} total={stats.total} mine={viewer.rating} />
            ) : (
              <p className="border border-dashed border-hair px-5 py-10 text-center text-[14px] text-muted">No ratings yet. Yours could be the first.</p>
            )}
            {viewer.rating && <p className="mt-3 text-[13px] text-muted">Your rating is highlighted in cobalt.</p>}
          </section>

          {/* Stats */}
          <section aria-labelledby="h-stats">
            <h2 id="h-stats" className="sec-title mb-5">Summary</h2>
            <dl className="grid grid-cols-2 border-l border-t border-hair">
              {([
                ["Average", f2(stats.mean), "Arithmetic mean"],
                ["Median", stats.median == null ? "–" : String(stats.median), "Middle rating"],
                ["Std. deviation", f2(stats.stdDev), "Spread of opinion"],
                ["Weighted score", f2(wr), "Used for the Top 250"],
              ] as const).map(([k, val, sub]) => (
                <div key={k} className="border-b border-r border-hair p-4">
                  <dt className="lbl text-muted">{k}</dt>
                  <dd className="mt-2 text-[26px] font-semibold leading-none tabular-nums">{val}</dd>
                  <dd className="mt-1.5 text-[12px] text-muted">{sub}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 bg-hair-2 p-4 text-[13px] leading-relaxed text-ink-2">
              <p className="lbl mb-2 text-cobalt">How the weighted score works</p>
              <p>
                We blend this book&apos;s average with the catalog average so a handful of votes can&apos;t top the charts:
              </p>
              <p className="my-2.5 font-mono text-[12.5px] text-ink">WR = (v ÷ (v+m)) × R + (m ÷ (v+m)) × C</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px]">
                <li>v = {v.toLocaleString("en-US")} votes</li>
                <li>m = {m} minimum</li>
                <li>R = {f2(R)} this book</li>
                <li>C = {f2(C)} catalog</li>
              </ul>
              <p className="mt-2.5">Books need at least {m} ratings to enter the <Link href="/chart/top" className="font-semibold text-cobalt hover:underline">Top 250</Link>.</p>
            </div>
          </section>
        </div>

        {/* Over time */}
        <section className="mt-12" aria-labelledby="h-time">
          <h2 id="h-time" className="sec-title mb-2">Ratings over time</h2>
          <p className="mb-5 pl-4 text-[14px] text-muted">Number of ratings submitted each year, with that year&apos;s average.</p>
          {years.length ? (
            <>
              <div className="overflow-x-auto border border-hair bg-card px-4 pb-3 pt-6">
                <ol className="flex h-56 min-w-max items-end justify-around gap-3 sm:min-w-0" aria-hidden>
                  {years.map((y) => (
                    <li key={y.year} className="group flex h-full min-w-12 max-w-[120px] flex-1 flex-col items-center justify-end" title={`${y.year}: ${y.count} ratings, average ${y.avg.toFixed(1)}`}>
                      <span className="mb-1 text-[12px] font-semibold tabular-nums text-ink opacity-80 group-hover:opacity-100">{y.count}</span>
                      <span className="w-full max-w-10 rounded-t-[4px] bg-cobalt transition-[filter] group-hover:brightness-110" style={{ height: `${Math.max(2, (y.count / maxYear) * 78)}%` }} />
                      <span className="mt-2 border-t border-hair pt-1.5 text-[12px] tabular-nums text-muted">{y.year}</span>
                      <span className="text-[11px] tabular-nums text-ink-2">★ {y.avg.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <details className="mt-3 text-[13px]">
                <summary className="cursor-pointer font-semibold text-cobalt">View as table</summary>
                <table className="mt-3 w-full max-w-md text-left tabular-nums">
                  <thead><tr className="border-b border-hair text-muted"><th className="py-1.5 font-semibold">Year</th><th className="font-semibold">Ratings</th><th className="font-semibold">Average</th></tr></thead>
                  <tbody>{years.map((y) => <tr key={y.year} className="border-b border-hair"><td className="py-1.5">{y.year}</td><td>{y.count}</td><td>{y.avg.toFixed(2)}</td></tr>)}</tbody>
                </table>
              </details>
            </>
          ) : (
            <p className="border border-dashed border-hair px-5 py-10 text-center text-[14px] text-muted">No rating history yet.</p>
          )}
        </section>

        <p className="mt-10">
          <Link href={`/book/${id}/reviews`} className="text-[14px] font-semibold text-cobalt hover:underline">Read the user reviews →</Link>
        </p>
      </div>
    </>
  );
}
