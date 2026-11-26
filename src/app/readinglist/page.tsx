import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getGenres } from "@/lib/queries/books";
import { getShelf, getShelfCounts, SHELF_SORTS, type ShelfSort } from "@/lib/queries/users";
import type { ShelfStatus } from "@/db/schema";
import { SectionHeader } from "@/components/ui/Section";
import { SignInPrompt } from "@/components/user/SignInPrompt";
import { SortToolbar } from "@/components/user/SortToolbar";
import { ShelfRow, ShelfTile } from "@/components/user/ShelfItems";
import { plural } from "@/lib/util";
import { qs } from "@/components/user/qs";

export const metadata: Metadata = { title: "Your Reading List" };

const TABS: { key: ShelfStatus; label: string }[] = [
  { key: "want", label: "Want to Read" },
  { key: "reading", label: "Currently Reading" },
  { key: "read", label: "Read" },
];
const SORT_OPTIONS: [string, string][] = [
  ["added", "Date added"], ["title", "Title"], ["rating", "BOOKLORE rating"],
  ["popularity", "Popularity"], ["year", "Year"], ["pages", "Pages"],
];

type SP = { status?: string; sort?: string; genre?: string; view?: string };

export default async function ReadingListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) {
    return (
      <div className="page py-14">
        <SignInPrompt next="/readinglist" title="Your Reading List" body="Keep track of what you want to read, what you are reading now, and what you have finished." />
      </div>
    );
  }

  const status: ShelfStatus = TABS.some((t) => t.key === sp.status) ? (sp.status as ShelfStatus) : "want";
  const sort: ShelfSort = sp.sort && sp.sort in SHELF_SORTS ? (sp.sort as ShelfSort) : "added";
  const genres = getGenres();
  const genre = genres.some((g) => g.slug === sp.genre) ? sp.genre! : "";
  const view = sp.view === "grid" ? "grid" : "list";

  const counts = getShelfCounts(me.id);
  const items = getShelf(me.id, status, { sort, genre: genre || null });
  const totalPages = items.reduce((s, i) => s + (i.pages ?? 0), 0);

  return (
    <div className="page py-10 md:py-14">
      <SectionHeader as="h1" kanji="読みたい本 · Reading List" title="Your Reading List"
        subtitle="Books you want to read, are reading now, or have finished." />

      <nav aria-label="Reading list status" className="mb-6 flex gap-x-7 gap-y-2 overflow-x-auto border-b border-hair">
        {TABS.map((t) => (
          <Link key={t.key} href={`/readinglist${qs({ status: t.key, sort: sort === "added" ? "" : sort, genre, view })}`}
            aria-current={status === t.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-[15px] font-semibold transition-colors ${status === t.key ? "border-cobalt text-cobalt" : "border-transparent text-ink-2 hover:text-ink"}`}>
            {t.label} <span className="ml-1 text-[13px] font-medium text-muted tabular-nums">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[15px] text-ink-2" aria-live="polite">
          <span className="font-semibold text-ink">{plural(items.length, "book")}</span>
          {totalPages > 0 && <>, <span className="font-semibold text-ink">~{totalPages.toLocaleString("en-US")} pages</span></>}
        </p>
      </div>

      <SortToolbar
        sort={sort} sortOptions={SORT_OPTIONS} genre={genre}
        genreOptions={[["", "All genres"], ...genres.map((g) => [g.slug, g.name] as [string, string])]}
        view={view} params={{ status, sort: sort === "added" ? undefined : sort, genre: genre || undefined, view }}
      />

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="lbl text-cobalt font-jp">空の棚</p>
          <p className="mt-3 text-lg font-semibold">Nothing on this shelf{genre ? " for that genre" : ""} yet.</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">
            Use the bookmark on any cover, or the Want to Read button on a title page, to add books here.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/chart/top" className="btn btn-outline">Browse the Top 250</Link>
            <Link href="/recommendations" className="btn btn-ghost">Get recommendations</Link>
          </div>
        </div>
      ) : view === "list" ? (
        <ul className="mt-2">
          {items.map((i) => <ShelfRow key={i.id} item={i} />)}
        </ul>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((i) => <ShelfTile key={i.id} item={i} />)}
        </ul>
      )}
    </div>
  );
}
