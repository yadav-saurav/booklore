import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getUserStates } from "@/lib/queries/books";
import { SearchBox } from "@/components/layout/SearchBox";
import { SegmentLinks, type Segment } from "@/components/chart/SegmentLinks";
import { buildHref } from "@/components/chart/url";
import { Pagination } from "@/components/search/Pagination";
import { EmptyState } from "@/components/search/EmptyState";
import { ExternalResults, ExternalSkeleton } from "@/components/search/ExternalResults";
import { AuthorResult, ListResult, ResultSection, TitleResult } from "@/components/search/SearchResults";
import { asIsbn, localAuthors, localByIsbn, localLists, localTitles } from "@/app/search/data";

const TYPES = [
  { value: "all", label: "All" },
  { value: "books", label: "Titles" },
  { value: "authors", label: "Authors" },
  { value: "lists", label: "Lists" },
  { value: "isbn", label: "ISBN" },
] as const;
type SearchType = (typeof TYPES)[number]["value"];

const PAGE = 20;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  return { title: q ? `“${q.slice(0, 60)}” search` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const str = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;
  const q = (str("q") ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
  const typeRaw = str("type") ?? "all";
  const type: SearchType = (TYPES.map((t) => t.value) as string[]).includes(typeRaw) ? (typeRaw as SearchType) : "all";
  const pageRaw = Number(str("page"));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 500 ? pageRaw : 1;
  const user = await getCurrentUser();

  const header = (
    <div className="page pt-6">
      <div className="max-w-2xl">
        <SearchBox />
      </div>
    </div>
  );

  if (!q) {
    return (
      <>
        {header}
        <div className="page py-12">
          <EmptyState title="Search the archive">
            Look up a title, an author, a list or an ISBN. Results from the BOOKLORE catalog come first, then matches from Open Library.
          </EmptyState>
          <p className="mt-6 text-[14px] text-muted">
            Need to narrow things down? Try <Link href="/search/advanced" className="font-semibold text-cobalt underline underline-offset-2">advanced title search</Link>.
          </p>
        </div>
      </>
    );
  }

  const isbn = asIsbn(q);
  const wantTitles = type === "all" || type === "books";
  const wantAuthors = type === "all" || type === "authors";
  const wantLists = type === "all" || type === "lists";
  const wantExternal = type === "all" || type === "books" || type === "isbn";

  const titleOffset = type === "books" ? (page - 1) * PAGE : 0;
  const titles = wantTitles ? localTitles(q, type === "books" ? PAGE : 6, titleOffset) : { books: [] as ReturnType<typeof localTitles>["books"], total: 0 };
  const authors = wantAuthors ? localAuthors(q, type === "authors" ? 40 : 5) : [];
  const listOffset = type === "lists" ? (page - 1) * PAGE : 0;
  const lists = wantLists ? localLists(q, type === "lists" ? PAGE : 5, listOffset) : { lists: [], total: 0 };
  const isbnBooks = type === "isbn" || (type === "all" && isbn) ? (isbn ? localByIsbn(isbn) : []) : [];

  const shownTitles = type === "isbn" ? isbnBooks : titles.books;
  const states = getUserStates(user?.id, shownTitles.map((b) => b.id));
  const exact = shownTitles.find((b) => norm(b.title) === norm(q)) ?? null;
  const exactAuthor = authors.find((a) => norm(a.name) === norm(q)) ?? null;
  const anyLocal = titles.total + authors.length + lists.total + isbnBooks.length > 0;

  const tabs: Segment[] = TYPES.map((t) => ({
    label: t.label,
    active: t.value === type,
    href: buildHref("/search", { q, type: t.value === "all" ? undefined : t.value }),
  }));

  // Streamed: local results above are already in the HTML when this boundary resolves.
  const externalSection = wantExternal && (type !== "isbn" || isbn) ? (
    <Suspense key={`${type}:${q}:${page}`} fallback={<ExternalSkeleton />}>
      <ExternalResults q={q} isbn={type === "isbn" ? isbn : null} local={[...shownTitles, ...isbnBooks]} limit={20} />
    </Suspense>
  ) : null;

  return (
    <>
      {header}
      <div className="page pb-16">
        <div className="mt-6 flex flex-col gap-4 border-b border-hair pb-4">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] md:text-[30px]">
            Results for <span className="text-cobalt">“{q}”</span>
          </h1>
          <SegmentLinks label="Result type" items={tabs} />
        </div>

        {type === "isbn" && !isbn && (
          <p className="mt-8 text-[15px] text-muted">Enter a 10- or 13-digit ISBN to look up an exact edition. Hyphens and spaces are fine.</p>
        )}

        {exact && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border border-cobalt/40 bg-cobalt-soft px-4 py-3 text-[15px]">
            <span className="lbl text-cobalt">{isbn ? "ISBN match" : "Exact match"}</span>
            <Link href={`/book/${exact.id}`} className="font-semibold hover:underline">{exact.title}</Link>
            {exact.authorName && <span className="text-muted">by {exact.authorName}</span>}
          </div>
        )}
        {!exact && exactAuthor && type !== "books" && type !== "isbn" && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border border-cobalt/40 bg-cobalt-soft px-4 py-3 text-[15px]">
            <span className="lbl text-cobalt">Exact match</span>
            <Link href={`/author/${exactAuthor.id}`} className="font-semibold hover:underline">{exactAuthor.name}</Link>
          </div>
        )}

        {!anyLocal && type !== "isbn" && (
          <div className="mt-8">
            <EmptyState title={`Nothing in BOOKLORE for “${q}”`}>
              Check the spelling, try fewer words, or look below for matches from Open Library.
            </EmptyState>
          </div>
        )}

        {type === "isbn" && isbn && isbnBooks.length === 0 && (
          <p className="mt-8 text-[15px] text-muted">No BOOKLORE edition has ISBN {isbn} yet. Open Library results below may include it.</p>
        )}

        {wantTitles && (type === "books" || titles.books.length > 0) && (
          <ResultSection
            id="titles"
            title="Titles"
            count={titles.total}
            moreHref={type === "all" && titles.total > titles.books.length ? buildHref("/search", { q, type: "books" }) : undefined}
            moreLabel="More titles"
          >
            {titles.books.map((b) => <TitleResult key={b.id} book={b} state={states[b.id]} />)}
          </ResultSection>
        )}
        {type === "books" && (
          <Pagination page={page} pageSize={PAGE} total={titles.total} basePath="/search" params={{ q, type: "books" }} label="Title result pages" />
        )}

        {wantAuthors && authors.length > 0 && (
          <ResultSection id="authors" title="Authors" count={authors.length}>
            {authors.map((a) => <AuthorResult key={a.id} author={a} />)}
          </ResultSection>
        )}

        {wantLists && lists.lists.length > 0 && (
          <ResultSection
            id="lists"
            title="Lists"
            count={lists.total}
            moreHref={type === "all" && lists.total > lists.lists.length ? buildHref("/search", { q, type: "lists" }) : undefined}
            moreLabel="More lists"
          >
            {lists.lists.map((l) => <ListResult key={l.id} list={l} />)}
          </ResultSection>
        )}
        {type === "lists" && (
          <Pagination page={page} pageSize={PAGE} total={lists.total} basePath="/search" params={{ q, type: "lists" }} label="List result pages" />
        )}

        {isbnBooks.length > 0 && type === "isbn" && (
          <ResultSection id="isbn" title="Editions" count={isbnBooks.length}>
            {isbnBooks.map((b) => <TitleResult key={b.id} book={b} state={states[b.id]} />)}
          </ResultSection>
        )}

        {externalSection}
      </div>
    </>
  );
}
