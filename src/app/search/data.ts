import "server-only";
import { db } from "@/db";
import { countLocalBooks, searchLocalAuthors, searchLocalBooks, type AuthorHit } from "@/lib/search";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";
import { escapeLike } from "@/lib/queries/advanced";

export type ListHit = { id: number; title: string; description: string; likeCount: number; itemCount: number; username: string; displayName: string };

/** Local title hits, paginated. `total` is the full FTS match count, for "More titles". */
export async function localTitles(q: string, limit: number, offset: number): Promise<{ books: BookCard[]; total: number }> {
  const [books, total] = await Promise.all([searchLocalBooks(q, limit, offset), countLocalBooks(q)]);
  return { books, total };
}

export function localAuthors(q: string, limit: number): Promise<AuthorHit[]> {
  return searchLocalAuthors(q, limit);
}

/** Public lists whose title contains the query. */
export async function localLists(q: string, limit: number, offset: number): Promise<{ lists: ListHit[]; total: number }> {
  const t = q.trim();
  if (!t) return { lists: [], total: 0 };
  const pattern = `%${escapeLike(t)}%`;
  const lists = await db.all<ListHit>(
      `SELECT l.id, l.title, l.description, l.like_count likeCount,
         (SELECT count(*) FROM list_items li WHERE li.list_id = l.id) itemCount,
         u.username, u.display_name displayName
       FROM lists l JOIN users u ON u.id = l.user_id
       WHERE l.is_public = 1 AND l.title ILIKE ? ESCAPE '\\'
       ORDER BY l.like_count DESC, l.id ASC LIMIT ? OFFSET ?`,
      pattern, limit, offset,
  );
  const total = (await db.get<{ n: number }>(
    `SELECT count(*) n FROM lists l WHERE l.is_public = 1 AND l.title ILIKE ? ESCAPE '\\'`, pattern,
  ))?.n ?? 0;
  return { lists, total };
}

/** Exact ISBN-13 or ISBN-10 match in the local catalog (hyphens and spaces ignored). */
export function localByIsbn(isbn: string): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE replace(replace(coalesce(b.isbn13, ''), '-', ''), ' ', '') = ? LIMIT 5`,
    isbn,
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Keys used to drop external results that the local catalog already has. */
export async function dedupeKeys(cards: BookCard[]) {
  const ids = cards.map((c) => c.id);
  const olKeys = new Set<string>();
  const isbns = new Set<string>();
  if (ids.length) {
    const ph = ids.map(() => "?").join(",");
    const rows = await db.all<{ k: string | null; i: string | null }>(`SELECT ol_work_key k, isbn13 i FROM books WHERE id IN (${ph})`, ...ids);
    for (const r of rows) {
      if (r.k) olKeys.add(r.k);
      if (r.i) isbns.add(r.i);
    }
  }
  const titles = new Set(cards.map((c) => `${norm(c.title)}|${norm((c.authorName ?? "").split(",")[0])}`));
  return { olKeys, isbns, titles };
}

/** Returns the normalised digits when the query is an ISBN-10 or ISBN-13, otherwise null. */
export function asIsbn(q: string): string | null {
  const s = q.replace(/[\s-]/g, "");
  return /^(\d{9}[\dX]|\d{13})$/i.test(s) ? s.toUpperCase() : null;
}
