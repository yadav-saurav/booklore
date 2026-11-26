import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/Section";
import { ListCard } from "@/components/lists/ListCard";
import { getFeaturedLists, getPopularLists, getRecentLists, countPublicLists, type ListSummary } from "@/lib/queries/lists";
import { qs } from "@/components/user/qs";

export const metadata: Metadata = { title: "Lists" };

const PER_PAGE = 12;

function Shelf({ title, lists, id }: { title: string; lists: ListSummary[]; id: string }) {
  if (!lists.length) return null;
  return (
    <section aria-labelledby={id} className="py-8">
      <h2 id={id} className="sec-title mb-6 text-[20px]">{title}</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
        {lists.map((l) => <li key={l.id}><ListCard list={l} /></li>)}
      </ul>
    </section>
  );
}

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const featured = getFeaturedLists(6);
  const popular = getPopularLists(8);
  const recent = getRecentLists(PER_PAGE, (page - 1) * PER_PAGE);
  const total = countPublicLists();
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="page py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeader as="h1" kanji="リスト · Lists" title="Lists"
          subtitle="Themed collections from readers across the archive. Make your own and share it." />
        <Link href="/list/new" className="btn btn-primary mb-4">Create a list</Link>
      </div>

      {total === 0 ? (
        <div className="py-20 text-center">
          <p className="text-lg font-semibold">No public lists yet.</p>
          <p className="mt-2 text-[15px] text-muted">Be the first to make one.</p>
        </div>
      ) : (
        <>
          <Shelf id="featured-h" title="Featured lists" lists={featured} />
          <Shelf id="popular-h" title="Popular lists" lists={popular} />

          <section aria-labelledby="recent-h" className="border-t border-hair py-8">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 id="recent-h" className="sec-title text-[20px]">Recently updated</h2>
              <p className="text-[13px] text-muted">Page {page} of {pages}</p>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
              {recent.map((l) => <li key={l.id}><ListCard list={l} /></li>)}
            </ul>
            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                {page > 1 && <Link href={`/lists${qs({ page: String(page - 1) })}`} className="btn btn-outline btn-sm">← Newer</Link>}
                {page < pages && <Link href={`/lists${qs({ page: String(page + 1) })}`} className="btn btn-outline btn-sm">Older →</Link>}
              </nav>
            )}
          </section>
        </>
      )}
    </div>
  );
}
