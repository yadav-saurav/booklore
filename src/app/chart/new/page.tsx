import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { maybeRefreshRankings } from "@/lib/aggregates";
import { getGenres, getUserStates } from "@/lib/queries/books";
import { countNewAndNotable, getNewAndNotable, NEW_PAGE_SIZE, newYearOptions } from "@/lib/queries/charts";
import { ChartTabs } from "@/components/chart/ChartTabs";
import { ChartHeader } from "@/components/chart/ChartHeader";
import { ChartListRow } from "@/components/chart/ChartRows";
import { ChartSidebar } from "@/components/chart/ChartSidebar";
import { SegmentLinks, type Segment } from "@/components/chart/SegmentLinks";
import { buildHref } from "@/components/chart/url";
import { Pagination } from "@/components/search/Pagination";
import { EmptyState } from "@/components/search/EmptyState";
import { plural } from "@/lib/util";

export const metadata: Metadata = {
  title: "New & Notable",
  description: "Books first published in the last four years, ranked by popularity on BOOKLORE.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NewPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;
  const years = newYearOptions();
  const yearRaw = Number(str("year"));
  const year = years.includes(yearRaw) ? yearRaw : null;
  const pageRaw = Number(str("page"));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 200) : 1;

  await maybeRefreshRankings();
  const total = await countNewAndNotable({ year });
  const offset = (page - 1) * NEW_PAGE_SIZE;
  const books = await getNewAndNotable({ year, offset, limit: NEW_PAGE_SIZE });
  const user = await getCurrentUser();
  const states = await getUserStates(user?.id, books.map((b) => b.id));
  const genres = await getGenres();

  const yearSegments: Segment[] = [
    { label: "All years", active: !year, href: buildHref("/chart/new") },
    ...years.map((y) => ({ label: String(y), active: y === year, href: buildHref("/chart/new", { year: y }) })),
  ];

  return (
    <>
      <ChartTabs active="new" />
      <div className="page grid gap-10 pb-16 md:grid-cols-[minmax(0,1fr)_268px]">
        <div className="min-w-0">
          <ChartHeader kanji="新刊" title="New & Notable" subtitle={`Books first published in the last ${years.length} years, ranked by popularity.`} />
          <div className="flex flex-col gap-3 border-y border-hair py-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="lbl w-16 text-muted">Year</span>
              <SegmentLinks label="Filter by publication year" items={yearSegments} />
            </div>
            <p className="text-[14px] font-semibold text-muted" aria-live="polite">
              {total === 0 ? "No titles" : `${offset + 1}–${Math.min(offset + NEW_PAGE_SIZE, total)} of ${plural(total, "title", "titles")}`}
            </p>
          </div>

          {books.length === 0 ? (
            <EmptyState title="No new titles for this year" action={<a className="btn btn-outline btn-sm" href="/chart/new">Show all years</a>}>
              Try another publication year, or browse the whole catalog.
            </EmptyState>
          ) : (
            <ol>
              {books.map((b, i) => (
                <ChartListRow key={b.id} book={b} rank={offset + i + 1} state={states[b.id]} />
              ))}
            </ol>
          )}
          <Pagination page={page} pageSize={NEW_PAGE_SIZE} total={total} basePath="/chart/new" params={{ year }} label="New and notable pages" />
        </div>
        <ChartSidebar genres={genres} />
      </div>
    </>
  );
}
