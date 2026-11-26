import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { maybeRefreshRankings } from "@/lib/aggregates";
import { getUserStates } from "@/lib/queries/books";
import { getMostPopular, POPULAR_LIMIT } from "@/lib/queries/charts";
import { ChartTabs } from "@/components/chart/ChartTabs";
import { ChartHeader } from "@/components/chart/ChartHeader";
import { ChartListRow, ChartCompactRow, CHART_VIEWS, type ChartView } from "@/components/chart/ChartRows";
import { ChartSidebar } from "@/components/chart/ChartSidebar";
import { SegmentLinks, type Segment } from "@/components/chart/SegmentLinks";
import { buildHref } from "@/components/chart/url";
import { BookCard } from "@/components/book/BookCard";
import { EmptyState } from "@/components/search/EmptyState";
import { getGenres } from "@/lib/queries/books";
import { plural } from "@/lib/util";

export const metadata: Metadata = {
  title: "Most Popular Books",
  description: "The books BOOKLORE readers are talking about this week, with movement since the last update.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function BookMeterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const viewRaw = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const view: ChartView = viewRaw === "grid" || viewRaw === "compact" ? viewRaw : "list";

  await maybeRefreshRankings();
  const user = await getCurrentUser();
  const books = await getMostPopular(POPULAR_LIMIT);
  const states = await getUserStates(user?.id, books.map((b) => b.id));
  const genres = await getGenres();

  const viewSegments: Segment[] = CHART_VIEWS.map((v) => ({
    label: v.label,
    active: v.value === view,
    href: buildHref("/chart/bookmeter", { view: v.value === "list" ? undefined : v.value }),
  }));

  return (
    <>
      <ChartTabs active="bookmeter" />
      <div className="page grid gap-10 pb-16 md:grid-cols-[minmax(0,1fr)_268px]">
        <div className="min-w-0">
          <ChartHeader
            kanji="人気"
            title="Most Popular Books"
            subtitle="Ranked by this week's reading activity. Arrows show movement since the last update."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-hair py-3.5">
            <p className="text-[14px] font-semibold text-muted" aria-live="polite">
              Top {books.length} · {plural(books.length, "title", "titles")}
            </p>
            <SegmentLinks label="View" items={viewSegments} />
          </div>

          {books.length === 0 ? (
            <EmptyState title="The chart is warming up">Popularity is calculated from reads, ratings and shelf adds. Check back soon.</EmptyState>
          ) : view === "grid" ? (
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,160px)] justify-center gap-x-4 gap-y-8 md:justify-start">
              {books.map((b) => (
                <li key={b.id}>
                  <BookCard book={b} state={states[b.id]} rank={b.popularityRank ?? undefined} width={160} />
                </li>
              ))}
            </ul>
          ) : view === "compact" ? (
            <ol className="border-t border-hair">
              {books.map((b) => (
                <ChartCompactRow key={b.id} book={b} rank={b.popularityRank ?? 0} movement />
              ))}
            </ol>
          ) : (
            <ol>
              {books.map((b) => (
                <ChartListRow key={b.id} book={b} rank={b.popularityRank ?? 0} state={states[b.id]} movement />
              ))}
            </ol>
          )}
        </div>
        <ChartSidebar genres={genres} />
      </div>
    </>
  );
}
