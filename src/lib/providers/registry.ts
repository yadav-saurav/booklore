import type { BookProvider, ExternalBook, ProviderId, SearchOptions } from "./types";
import { openLibrary } from "./openlibrary";
import { googleBooks } from "./googlebooks";

/** Order = priority. Open Library is primary; Google Books fills gaps. Add new sources here. */
export const providers: BookProvider[] = [openLibrary, googleBooks];

export function getProvider(id: string): BookProvider | undefined {
  return providers.find((p) => p.id === id && p.enabled());
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const dedupeKey = (b: ExternalBook) => b.isbn13 ?? `${norm(b.title)}|${norm(b.authors[0]?.name ?? "")}`;

/** Fan out to every enabled provider (in parallel), merge, and de-duplicate by ISBN / title+author. */
export async function searchExternal(query: string, opts: SearchOptions & { sources?: ProviderId[] } = {}) {
  const active = providers.filter((p) => p.enabled() && (!opts.sources || opts.sources.includes(p.id)));
  const settled = await Promise.allSettled(active.map((p) => p.searchBooks(query, opts)));
  const seen = new Map<string, ExternalBook>();
  settled.forEach((r) => {
    if (r.status !== "fulfilled") return;
    for (const b of r.value) {
      const k = dedupeKey(b);
      const k2 = `${norm(b.title)}|${norm(b.authors[0]?.name ?? "")}`;
      if (seen.has(k) || seen.has(k2)) continue;
      seen.set(k, b);
      seen.set(k2, b);
    }
  });
  return [...new Set(seen.values())];
}

export type { BookProvider, ExternalBook, ProviderId, SearchOptions };
