import Link from "next/link";
import type { BookCard, UserBookState } from "@/lib/queries/books";
import type { GenreSort } from "@/lib/queries/genres";
import { BookCard as Poster, BookRow } from "@/components/book/BookCard";
import { ChipRow } from "./ChipRow";
import { Pager } from "./Pager";
import { hrefWith, type Params } from "./href";

export const SORT_OPTIONS: { key: GenreSort; label: string }[] = [
  { key: "popularity", label: "Popularity" },
  { key: "rating", label: "Top rated" },
  { key: "ratings", label: "Most ratings" },
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "title", label: "Title A–Z" },
];
const MIN_OPTIONS = [6, 7, 8, 9];

type Props = {
  path: string; current: Params; sort: GenreSort; decade?: number; minRating?: number; view: "grid" | "list";
  decades: { decade: number; count: number }[]; rows: BookCard[]; total: number; page: number; pageSize: number;
  states: Record<string, UserBookState>;
};

/** Filter chips, grid/list toggle, results and pagination. All state lives in the URL. */
export function GenreBrowse({ path, current, sort, decade, minRating, view, decades, rows, total, page, pageSize, states }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const reset = { page: undefined };

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-hair pb-5">
        <ChipRow label="Sort"
          items={SORT_OPTIONS.map((o) => ({ label: o.label, active: sort === o.key, href: hrefWith(path, current, { ...reset, sort: o.key === "popularity" ? undefined : o.key }) }))} />
        {decades.length > 0 && (
          <ChipRow label="Decade"
            items={[{ label: "All", active: !decade, href: hrefWith(path, current, { ...reset, decade: undefined }) },
              ...decades.map((d) => ({ label: `${d.decade}s`, active: decade === d.decade, href: hrefWith(path, current, { ...reset, decade: d.decade }) }))]} />
        )}
        <ChipRow label="Rating"
          items={[{ label: "Any", active: !minRating, href: hrefWith(path, current, { ...reset, min: undefined }) },
            ...MIN_OPTIONS.map((m) => ({ label: `${m}+`, active: minRating === m, href: hrefWith(path, current, { ...reset, min: m }) }))]} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted" aria-live="polite">
          {total ? <>Showing <span className="font-semibold text-ink">{from.toLocaleString("en-US")}–{to.toLocaleString("en-US")}</span> of {total.toLocaleString("en-US")}</> : "No matching books"}
        </p>
        <div className="flex border border-rule text-[13px] font-semibold" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => (
            <Link key={v} href={hrefWith(path, current, { view: v === "grid" ? undefined : v })} aria-pressed={view === v}
              className={`flex h-8 items-center gap-1.5 px-3 ${view === v ? "bg-ink text-paper" : "hover:bg-hair-2"}`}>
              {v === "grid" ? (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M1 1h6v6H1zM9 1h6v6H9zM1 9h6v6H1zM9 9h6v6H9z" /></svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M1 2h14v2H1zM1 7h14v2H1zM1 12h14v2H1z" /></svg>
              )}
              {v === "grid" ? "Grid" : "List"}
            </Link>
          ))}
        </div>
      </div>

      {rows.length ? (
        view === "grid" ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 [&>li>article]:!w-full">
            {rows.map((b) => (
              <li key={b.id}><Poster book={b} state={states[b.id]} /></li>
            ))}
          </ul>
        ) : (
          <ul className="mt-4 divide-y divide-hair">
            {rows.map((b) => (
              <li key={b.id} className="py-4"><BookRow book={b} /></li>
            ))}
          </ul>
        )
      ) : (
        <div className="mt-8 border border-dashed border-hair p-10 text-center">
          <p className="text-lg font-semibold">Nothing matches these filters</p>
          <p className="mt-1 text-muted">Try a lower minimum rating or a different decade.</p>
          <Link href={path} className="btn btn-outline btn-sm mt-5">Clear filters</Link>
        </div>
      )}

      <Pager path={path} current={current} page={page} pages={pages} />
    </div>
  );
}
