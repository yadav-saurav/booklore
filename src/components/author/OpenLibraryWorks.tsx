import Link from "next/link";
import { getProvider } from "@/lib/providers/registry";
import { existingOlWorkKeys, authorBookTitles } from "@/lib/queries/authors";
import { plural } from "@/lib/util";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Works by this author on Open Library that are not in the catalog yet. Each links to a book page
 * that imports the work on first visit (see resolveExternalRef).
 */
export async function OpenLibraryWorks({ authorId, olKey }: { authorId: string; olKey: string }) {
  const provider = getProvider("openlibrary");
  const works = provider?.getAuthorWorks ? await provider.getAuthorWorks(olKey, { limit: 40 }) : [];
  const have = existingOlWorkKeys(works.map((w) => w.externalId));
  const titles = new Set(authorBookTitles(authorId).map(norm));
  const seen = new Set<string>();
  const fresh = works.filter((w) => {
    const t = norm(w.title);
    if (have.has(w.externalId) || titles.has(t) || seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  if (!fresh.length) return <p className="text-muted">Nothing new to add from Open Library right now.</p>;

  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">{plural(fresh.length, "more work")} from Open Library.</p>
      <ul className="grid gap-x-8 divide-y divide-hair md:grid-cols-2 md:divide-y-0">
        {fresh.slice(0, 16).map((w) => (
          <li key={w.externalId} className="flex items-baseline justify-between gap-4 py-2.5">
            <Link href={`/book/${encodeURIComponent(`openlibrary:${w.externalId}`)}`} className="min-w-0 truncate font-semibold hover:underline">
              {w.title}
            </Link>
            <span className="shrink-0 text-[13px] tabular-nums text-muted">{w.firstPublishYear ?? ""}</span>
          </li>
        ))}
      </ul>
      {provider && (
        <p className="mt-4 text-[12px] text-muted">
          Works listed from{" "}
          <a href={provider.attribution.url} className="underline hover:text-cobalt" target="_blank" rel="noopener noreferrer">{provider.attribution.label}</a>
          . Opening one adds it to BOOKLORE.
        </p>
      )}
    </div>
  );
}
