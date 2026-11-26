"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SuggestBook } from "@/components/layout/SearchBox";
import { addBookByRef, addBookToList } from "@/app/actions/lists";

/** Search the catalog (and Open Library / Google Books) and add the chosen book to a list. */
export function BookSearchAdd({ listId, onAdded }: { listId: number; onAdded?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SuggestBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    const mine = ++seq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}&cat=books`);
        const data = (await res.json()) as { books: SuggestBook[] };
        if (mine === seq.current) setResults(data.books ?? []);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const add = async (b: SuggestBook) => {
    setBusy(b.id);
    setError(null);
    // External refs look like "openlibrary:OL…W"; local books are plain slugs.
    const r = b.id.includes(":") ? await addBookByRef(listId, b.id) : await addBookToList(listId, b.id);
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setAdded((s) => new Set(s).add(b.id));
    router.refresh();
    onAdded?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="book-search" className="lbl text-ink-2">Add a book</label>
        <input id="book-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off"
          placeholder="Search by title, author or ISBN" className="field h-11 text-[15px]" />
      </div>
      {error && <p role="alert" className="text-[13px] text-vermilion">{error}</p>}
      {q.trim().length >= 2 && (
        <ul className="divide-y divide-hair border border-hair bg-card" aria-live="polite">
          {searching && results.length === 0 && <li className="px-4 py-3 text-[14px] text-muted">Searching…</li>}
          {!searching && results.length === 0 && <li className="px-4 py-3 text-[14px] text-muted">No books match “{q.trim()}”.</li>}
          {results.map((b) => {
            const done = added.has(b.id);
            return (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="relative h-12 w-8 shrink-0 overflow-hidden bg-hair-2">
                  {b.coverId || b.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.coverId ? `https://covers.openlibrary.org/b/id/${b.coverId}-S.jpg` : b.coverUrl!} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{b.title}</p>
                  <p className="truncate text-[12.5px] text-muted">{[b.authorName, b.year].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <button type="button" disabled={done || busy === b.id} onClick={() => add(b)}
                  className={`btn btn-sm shrink-0 ${done ? "btn-ghost text-up" : "btn-outline"} disabled:opacity-70`}>
                  {done ? "Added ✓" : busy === b.id ? "Adding…" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
