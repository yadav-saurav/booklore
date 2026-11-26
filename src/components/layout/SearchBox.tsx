"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BookCover } from "@/components/book/BookCover";
import { SearchGlyph } from "./SiteHeader";

export type SuggestBook = { href: string; id: string; title: string; year: number | null; authorName: string | null; coverId: number | null; coverUrl: string | null; source: string };
export type SuggestAuthor = { href: string; name: string; knownFor: string | null; photoId: number | null };
type Suggest = { books: SuggestBook[]; authors: SuggestAuthor[] };

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "books", label: "Titles" },
  { value: "authors", label: "Authors" },
  { value: "lists", label: "Lists" },
  { value: "isbn", label: "ISBN" },
];

/** IMDb search field: category select + live suggestions (local catalog first, Open Library as fallback). */
export function SearchBox({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [data, setData] = useState<Suggest | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrap = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setData(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(term)}&cat=${cat}`, { signal: ctl.signal });
        if (r.ok) { setData(await r.json()); setActive(-1); }
      } catch { /* aborted */ }
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, cat]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = [...(data?.books ?? []).map((b) => b.href), ...(data?.authors ?? []).map((a) => a.href)];
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) { router.push(items[active]); setOpen(false); return; }
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}${cat !== "all" ? `&type=${cat}` : ""}`);
  };

  return (
    <form ref={wrap} onSubmit={submit} role="search" className="relative w-full">
      <div className="flex h-10 w-full items-stretch border border-hair bg-card focus-within:border-cobalt focus-within:shadow-[0_0_0_1px_var(--cobalt)]">
        <label className="sr-only" htmlFor={`${listId}-cat`}>Search category</label>
        <select id={`${listId}-cat`} value={cat} onChange={(e) => setCat(e.target.value)}
          className="cursor-pointer border-r border-hair bg-transparent pl-3 pr-1 text-[13px] font-semibold text-ink outline-none">
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input
          type="search" value={q} autoFocus={autoFocus} placeholder="Search BOOKLORE" aria-label="Search BOOKLORE"
          role="combobox" aria-expanded={open && !!data} aria-controls={listId} aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            if (e.key === "Escape") setOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Submit search" className="px-3 text-muted hover:text-cobalt"><SearchGlyph /></button>
      </div>
      <Link href="/search/advanced" className="lbl absolute -bottom-5 right-0 hidden text-muted hover:text-cobalt xl:block" tabIndex={-1}>
        Advanced
      </Link>

      {open && data && (data.books.length > 0 || data.authors.length > 0) && (
        <div id={listId} role="listbox" className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] max-h-[70vh] overflow-y-auto border border-hair bg-sheet shadow-card">
          {data.books.map((b, i) => (
            <Link key={b.href} href={b.href} role="option" aria-selected={active === i} onClick={() => setOpen(false)}
              className={`flex gap-3 border-b border-hair-2 px-3 py-2.5 hover:bg-cobalt-soft ${active === i ? "bg-cobalt-soft" : ""}`}>
              <div className="w-9 shrink-0"><BookCover book={b} size="S" /></div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{b.title}</p>
                <p className="truncate text-[13px] text-muted">{[b.year, b.authorName].filter(Boolean).join(" · ")}</p>
                {b.source !== "local" && <p className="lbl mt-1 text-[9px] text-cobalt">from {b.source === "google" ? "Google Books" : "Open Library"}</p>}
              </div>
            </Link>
          ))}
          {data.authors.map((a, j) => {
            const i = data.books.length + j;
            return (
              <Link key={a.href} href={a.href} role="option" aria-selected={active === i} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 border-b border-hair-2 px-3 py-2.5 hover:bg-cobalt-soft ${active === i ? "bg-cobalt-soft" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cobalt-soft text-sm font-semibold text-cobalt">
                  {a.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{a.name}</p>
                  {a.knownFor && <p className="truncate text-[13px] text-muted">{a.knownFor}</p>}
                </div>
              </Link>
            );
          })}
          <button type="submit" className="w-full px-3 py-3 text-left text-[14px] font-semibold text-cobalt hover:bg-cobalt-soft">
            See all results for &ldquo;{q}&rdquo;
          </button>
        </div>
      )}
    </form>
  );
}
