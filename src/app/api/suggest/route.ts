import { NextResponse } from "next/server";
import { searchLocalAuthors, searchLocalBooks } from "@/lib/search";
import { searchExternal } from "@/lib/providers/registry";
import { externalRef, findLocalByExternal } from "@/lib/catalog";
import { sqlite } from "@/db";
import type { SuggestAuthor, SuggestBook } from "@/components/layout/SearchBox";

/** Typeahead: local catalog first; when it has few hits, top up with live Open Library / Google Books results. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const cat = url.searchParams.get("cat") ?? "all";
  if (q.length < 2) return NextResponse.json({ books: [], authors: [] });

  let books: SuggestBook[] = [];
  let authors: SuggestAuthor[] = [];

  if (cat === "isbn") {
    const isbn = q.replace(/[^0-9Xx]/g, "");
    const local = sqlite.prepare(`SELECT id FROM books WHERE isbn13 = ?`).get(isbn) as { id: string } | undefined;
    if (local) {
      const [b] = searchLocalBooks(q, 1);
      if (b) books = [toSuggest(b)];
    }
    if (!books.length) books = (await searchExternal("", { isbn, limit: 3 })).map(extSuggest);
    return NextResponse.json({ books, authors });
  }

  if (cat === "all" || cat === "books") {
    books = searchLocalBooks(q, 6).map(toSuggest);
    if (books.length < 4) {
      const ext = await searchExternal(q, { limit: 8, sources: ["openlibrary"] });
      const seen = new Set(books.map((b) => b.title.toLowerCase()));
      for (const e of ext) {
        if (books.length >= 7) break;
        if (seen.has(e.title.toLowerCase())) continue;
        seen.add(e.title.toLowerCase());
        books.push(extSuggest(e));
      }
    }
  }
  if (cat === "all" || cat === "authors") {
    authors = searchLocalAuthors(q, cat === "authors" ? 8 : 3).map((a) => ({
      href: `/author/${a.id}`, name: a.name, knownFor: a.knownFor, photoId: a.photoId,
    }));
  }
  return NextResponse.json({ books, authors }, { headers: { "Cache-Control": "private, max-age=60" } });
}

const toSuggest = (b: ReturnType<typeof searchLocalBooks>[number]): SuggestBook => ({
  href: `/book/${b.id}`, id: b.id, title: b.title, year: b.year, authorName: b.authorName, coverId: b.coverId, coverUrl: b.coverUrl, source: "local",
});

function extSuggest(e: Awaited<ReturnType<typeof searchExternal>>[number]): SuggestBook {
  const local = findLocalByExternal(e.source, e.externalId);
  const ref = externalRef(e);
  return {
    href: local ? `/book/${local}` : `/book/${encodeURIComponent(ref)}`, id: local ?? ref, title: e.title, year: e.firstPublishYear ?? null,
    authorName: e.authors.map((a) => a.name).join(", ") || null, coverId: e.coverId ?? null, coverUrl: e.coverUrl ?? null, source: local ? "local" : e.source,
  };
}
