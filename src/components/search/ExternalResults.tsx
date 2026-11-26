import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import { RatingInline } from "@/components/book/Rating";
import { providers, searchExternal, type ExternalBook } from "@/lib/providers/registry";
import type { BookCard } from "@/lib/queries/books";
import { compact } from "@/lib/util";
import { dedupeKeys } from "@/app/search/data";

/** Link into the external import flow: /book/<source:externalId> imports the book on first visit. */
export const externalHref = (b: Pick<ExternalBook, "source" | "externalId">) =>
  `/book/${encodeURIComponent(`${b.source}:${b.externalId}`)}`;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Live results from external catalogues. Rendered behind a Suspense boundary so local results paint first.
 * Items already in BOOKLORE (same Open Library work, ISBN, or title + first author) are dropped.
 */
export async function ExternalResults({ q, isbn, local, limit = 20 }: {
  q: string; isbn?: string | null; local: BookCard[]; limit?: number;
}) {
  const keys = await dedupeKeys(local);
  const raw = await searchExternal(q, { limit, ...(isbn ? { isbn } : {}) });
  const items = raw.filter((b) => {
    if (b.source === "openlibrary" && keys.olKeys.has(b.externalId)) return false;
    if (b.isbn13 && keys.isbns.has(b.isbn13)) return false;
    return !keys.titles.has(`${norm(b.title)}|${norm(b.authors[0]?.name ?? "")}`);
  });

  return (
    <section aria-labelledby="ext-title" className="mt-12">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-hair pb-3">
        <h2 id="ext-title" className="sec-title text-[20px]">More results from Open Library</h2>
        {items.length > 0 && <p className="text-[13px] text-muted">{items.length} not yet in BOOKLORE</p>}
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-[15px] text-muted">No additional matches outside the BOOKLORE catalog for &ldquo;{q}&rdquo;.</p>
      ) : (
        <ol className="divide-y divide-hair">
          {items.map((b) => {
            const attribution = providers.find((p) => p.id === b.source)?.attribution;
            const authors = b.authors.map((a) => a.name).join(", ");
            const ref = `${b.source}:${b.externalId}`;
            return (
              <li key={ref} className="flex gap-3.5 py-4">
                <Link href={externalHref(b)} className="w-[60px] shrink-0" tabIndex={-1} aria-hidden>
                  <BookCover book={{ id: ref, title: b.title, coverId: b.coverId, coverUrl: b.coverUrl, authorName: authors }} size="S" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={externalHref(b)} className="font-semibold leading-snug hover:underline">{b.title}</Link>
                    <span className="box text-[10.5px] text-muted">{attribution?.label ?? b.source}</span>
                  </div>
                  <p className="text-[13px] text-muted">
                    {authors || "Unknown author"}
                    {b.firstPublishYear ? ` · ${b.firstPublishYear}` : ""}
                    {b.pages ? ` · ${b.pages} pages` : ""}
                  </p>
                  {b.subjects.length > 0 && <p className="mt-1 truncate text-[12.5px] text-muted">{b.subjects.slice(0, 4).join(" · ")}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {b.ratingAvg != null && <RatingInline avg={b.ratingAvg} count={b.ratingCount ?? undefined} />}
                    {b.wantToRead ? <span className="text-[13px] text-muted">{compact(b.wantToRead)} want to read</span> : null}
                    {attribution && (
                      <span className="text-[12.5px] text-muted">
                        Data from{" "}
                        <a className="underline underline-offset-2 hover:text-cobalt" href={attribution.url} rel="noopener noreferrer" target="_blank">
                          {attribution.label}
                        </a>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Placeholder rows shown while the external query runs. */
export function ExternalSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading more results" role="status" className="mt-12">
      <div className="skeleton mb-4 h-6 w-72 max-w-full" />
      <ul className="divide-y divide-hair">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex gap-3.5 py-4">
            <div className="skeleton h-[90px] w-[60px] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/5" />
              <div className="skeleton h-3 w-3/5" />
              <div className="skeleton h-3 w-1/4" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
