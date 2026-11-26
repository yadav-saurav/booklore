import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { maybeRefreshRankings, TOP_MIN_VOTES } from "@/lib/aggregates";
import { getGenres, getUserStates } from "@/lib/queries/books";
import { catalogMean, getTopRated, TOP_SORTS, parseTopSort, type TopSort } from "@/lib/queries/charts";
import { ChartTabs } from "@/components/chart/ChartTabs";
import { ChartHeader } from "@/components/chart/ChartHeader";
import { ChartListRow, ChartCompactRow, CHART_VIEWS, type ChartView } from "@/components/chart/ChartRows";
import { ChartSidebar } from "@/components/chart/ChartSidebar";
import { RankingExplainer } from "@/components/chart/RankingExplainer";
import { SegmentLinks, type Segment } from "@/components/chart/SegmentLinks";
import { buildHref } from "@/components/chart/url";
import { BookCard } from "@/components/book/BookCard";
import { EmptyState } from "@/components/search/EmptyState";
import { plural } from "@/lib/util";

export const metadata: Metadata = {
  title: "BOOKLORE Top 250 Books",
  description: "The BOOKLORE Top 250 books, ranked by a weighted score of ratings from regular readers.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

const SORT_HINTS: Record<TopSort, string> = {
  ranking: "Weighted score",
  rating: "Mean rating",
  votes: "How many readers rated it",
  year: "First publication year",
  title: "Alphabetical",
  pages: "Page count",
};

export default async function TopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = parseTopSort(str("sort"));
  const dirParam = str("dir");
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam : undefined;
  const effectiveDir = dir ?? TOP_SORTS[sort].dir;
  const genreRaw = str("genre") ?? "";
  const genre = /^[a-z0-9-]{1,40}$/.test(genreRaw) ? genreRaw : null;
  const viewRaw = str("view");
  const view: ChartView = viewRaw === "grid" || viewRaw === "compact" ? viewRaw : "list";

  await maybeRefreshRankings();
  const user = await getCurrentUser();
  const [books, genres, mean] = await Promise.all([getTopRated({ sort, dir, genre }), getGenres(), catalogMean()]);
  const states = await getUserStates(user?.id, books.map((b) => b.id));
  const genreName = genres.find((g) => g.slug === genre)?.name ?? null;
  const base = { sort: sort === "ranking" ? undefined : sort, dir, genre, view: view === "list" ? undefined : view };

  const sortSegments: Segment[] = (Object.keys(TOP_SORTS) as TopSort[]).map((k) => {
    const active = k === sort;
    const natural = TOP_SORTS[k].dir;
    // Clicking the active sort flips its direction; clicking another sort uses its natural direction.
    const nextDir = active ? (effectiveDir === "asc" ? "desc" : "asc") : undefined;
    return {
      label: TOP_SORTS[k].label,
      active,
      hint: SORT_HINTS[k],
      href: buildHref("/chart/top", { ...base, sort: k === "ranking" ? undefined : k, dir: active ? nextDir : undefined, view: base.view }),
    };
  });

  const genreSegments: Segment[] = [
    { label: "All genres", href: buildHref("/chart/top", { sort: base.sort, dir, view: base.view }), active: !genre },
    ...genres.slice(0, 14).map((g) => ({
      label: g.name,
      active: g.slug === genre,
      href: buildHref("/chart/top", { sort: base.sort, dir, view: base.view, genre: g.slug === genre ? undefined : g.slug }),
    })),
  ];

  const viewSegments: Segment[] = CHART_VIEWS.map((v) => ({
    label: v.label,
    active: v.value === view,
    href: buildHref("/chart/top", { ...base, view: v.value === "list" ? undefined : v.value }),
  }));

  return (
    <>
      <ChartTabs active="top" />
      <div className="page grid gap-10 pb-16 md:grid-cols-[minmax(0,1fr)_268px]">
        <div className="min-w-0">
          <ChartHeader kanji="頂 250" title="BOOKLORE Top 250 Books" subtitle="As rated by regular BOOKLORE readers">
            <RankingExplainer minVotes={TOP_MIN_VOTES} mean={mean} />
          </ChartHeader>

          <div className="flex flex-col gap-3 border-y border-hair py-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="lbl w-16 text-muted">Sort by</span>
              <SegmentLinks label="Sort by" items={sortSegments} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="lbl w-16 text-muted">Genre</span>
              <SegmentLinks label="Filter by genre" items={genreSegments} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] font-semibold text-muted" aria-live="polite">
                {plural(books.length, "Title")}
                {genreName ? <span className="font-normal"> in {genreName}</span> : null}
                <span className="font-normal"> · sorted by {TOP_SORTS[sort].label.toLowerCase()} {effectiveDir === "asc" ? "↑" : "↓"}</span>
              </p>
              <SegmentLinks label="View" items={viewSegments} />
            </div>
          </div>

          {books.length === 0 ? (
            <EmptyState title="No titles qualify yet">
              A book needs at least {TOP_MIN_VOTES} ratings before it can enter the Top 250. Rate a few books to help it fill up.
            </EmptyState>
          ) : view === "grid" ? (
            <ul className="mt-6 grid grid-cols-[repeat(auto-fill,160px)] justify-center gap-x-4 gap-y-8 md:justify-start">
              {books.map((b) => (
                <li key={b.id}>
                  <BookCard book={b} state={states[b.id]} rank={b.chartRank} width={160} />
                </li>
              ))}
            </ul>
          ) : view === "compact" ? (
            <ol className="mt-2 border-t border-hair">
              {books.map((b) => (
                <ChartCompactRow key={b.id} book={b} rank={b.chartRank} />
              ))}
            </ol>
          ) : (
            <ol className="border-b-0">
              {books.map((b) => (
                <ChartListRow key={b.id} book={b} rank={b.chartRank} state={states[b.id]} />
              ))}
            </ol>
          )}
        </div>
        <ChartSidebar genres={genres} />
      </div>
    </>
  );
}
