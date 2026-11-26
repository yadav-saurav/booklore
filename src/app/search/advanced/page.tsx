import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { tsQuery } from "@/lib/search";
import { CARD_COLUMNS, getGenres, getUserStates, queryCards } from "@/lib/queries/books";
import {
  ADV_PAGE_SIZE,
  activeChips,
  buildAdvancedQuery,
  chipRemoveNames,
  filtersToEntries,
  parseAdvanced,
  type RawParams,
} from "@/lib/queries/advanced";
import { BookRow } from "@/components/book/BookCard";
import { RateButton } from "@/components/book/RateButton";
import { Pagination } from "@/components/search/Pagination";
import { EmptyState } from "@/components/search/EmptyState";
import { FilterSheet } from "@/components/search/FilterSheet";
import { AdvancedForm, FORM_ID } from "@/components/search/AdvancedForm";
import { buildHref } from "@/components/chart/url";
import { plural } from "@/lib/util";

export const metadata: Metadata = {
  title: "Advanced title search",
  description: "Filter the BOOKLORE catalog by genre, year, rating, length, language and your own shelves.",
};

type SP = Promise<RawParams>;

export default async function AdvancedSearchPage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  const f = parseAdvanced(raw);
  const user = await getCurrentUser();
  const genres = await getGenres();
  const genreName = (slug: string) => genres.find((g) => g.slug === slug)?.name ?? slug;

  const { where, params, orderBy } = buildAdvancedQuery(f, user?.id, tsQuery);
  const total = (await db.get<{ n: number }>(`SELECT count(*) n FROM books b WHERE ${where}`, ...params))?.n ?? 0;
  const offset = (f.page - 1) * ADV_PAGE_SIZE;
  const books = await queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ...params,
    ADV_PAGE_SIZE,
    offset,
  );
  const states = await getUserStates(user?.id, books.map((b) => b.id));

  const entries = filtersToEntries(f);
  const chips = activeChips(f, genreName);
  // A chip removes its own params and resets to page 1.
  const removeHref = (name: string, value?: string) => {
    const kept = entries.filter(([k, v]) => !(chipRemoveNames(name).includes(k) && (value === undefined || v === value)) && k !== "page");
    const sp = new URLSearchParams(kept);
    const qs = sp.toString();
    return qs ? `/search/advanced?${qs}` : "/search/advanced";
  };

  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + ADV_PAGE_SIZE, total);

  return (
    <div className="page pb-16 pt-6">
      <header className="mb-6 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="lbl mb-2 font-jp text-cobalt">詳細検索</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[34px]">Advanced title search</h1>
          <p className="mt-1.5 text-[15px] text-muted">Combine filters. Every setting is in the URL, so you can share a search.</p>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="md:sticky md:top-20 md:max-h-[calc(100svh-6rem)] md:self-start md:overflow-y-auto md:pr-1">
          <FilterSheet formId={FORM_ID} activeCount={chips.length}>
            <AdvancedForm f={f} genres={genres} signedIn={!!user} />
          </FilterSheet>
        </div>

        <section className="min-w-0" aria-live="polite">
          <div className="flex flex-col gap-3 border-b border-hair pb-4">
            <p className="text-[15px] font-semibold">
              {total === 0 ? "No titles match" : <>{first.toLocaleString("en-US")}–{last.toLocaleString("en-US")} <span className="text-muted">of {plural(total, "title", "titles")}</span></>}
            </p>
            {chips.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
                {chips.map((c) => (
                  <li key={`${c.name}:${c.value ?? c.label}`}>
                    <Link
                      href={removeHref(c.name, c.value)}
                      className="chip border-cobalt/50 bg-cobalt-soft text-cobalt hover:bg-cobalt hover:text-cobalt-ink"
                      aria-label={`Remove filter ${c.label}`}
                    >
                      {c.label}
                      <span aria-hidden className="text-[15px] leading-none">×</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/search/advanced" className="chip">Clear all</Link>
                </li>
              </ul>
            )}
          </div>

          {total === 0 ? (
            <div className="mt-8">
              <EmptyState title="No titles match these filters" action={<Link href="/search/advanced" className="btn btn-outline btn-sm">Clear filters</Link>}>
                Loosen a range, remove a genre, or try a shorter keyword.
              </EmptyState>
            </div>
          ) : (
            <ul>
              {books.map((b) => (
                <li key={b.id} className="border-b border-hair py-4 last:border-b-0">
                  <BookRow
                    book={b}
                    meta={<RateButton bookId={b.id} title={b.title} current={states[b.id]?.rating ?? null} />}
                  />
                </li>
              ))}
            </ul>
          )}

          <Pagination page={f.page} pageSize={ADV_PAGE_SIZE} total={total} basePath="/search/advanced" params={entries} label="Advanced search pages" />
        </section>
      </div>
    </div>
  );
}
