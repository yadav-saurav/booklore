import "server-only";
import { db } from "@/db";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";

/**
 * Turn free text into a safe prefix tsquery string: `Dune herb` → `dune:* & herb:*`.
 * Letters/digits only, accent-folded, so it never produces a tsquery syntax error.
 */
export function tsQuery(q: string): string | null {
  const terms = q.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]+/gu);
  if (!terms?.length) return null;
  return terms.slice(0, 8).map((t) => `${t}:*`).join(" & ");
}

/** Local catalog full-text search: title > author > subtitle > subjects, blended with popularity. */
export async function searchLocalBooks(q: string, limit = 20, offset = 0): Promise<BookCard[]> {
  const tq = tsQuery(q);
  if (!tq) return [];
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books_search s JOIN books b ON b.id = s.book_id
     WHERE s.doc @@ to_tsquery('simple', ?)
     ORDER BY ts_rank(s.doc, to_tsquery('simple', ?), 1) * 10 + ln(1 + b.popularity_score) * 0.6 DESC, b.id
     LIMIT ? OFFSET ?`,
    tq, tq, limit, offset,
  );
}

/** Total matches for pagination. */
export async function countLocalBooks(q: string): Promise<number> {
  const tq = tsQuery(q);
  if (!tq) return 0;
  const r = await db.get<{ n: number }>(`SELECT count(*) n FROM books_search WHERE doc @@ to_tsquery('simple', ?)`, tq);
  return r?.n ?? 0;
}

export type AuthorHit = { id: string; name: string; photoId: number | null; birthDate: string | null; deathDate: string | null; knownFor: string | null; bookCount: number };

export async function searchLocalAuthors(q: string, limit = 10): Promise<AuthorHit[]> {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const where = terms.map(() => `unaccent_lite(a.name) LIKE unaccent_lite(?)`).join(" AND ");
  return db.all<AuthorHit>(
    `SELECT a.id, a.name, a.photo_id photoId, a.birth_date birthDate, a.death_date deathDate,
       (SELECT b.title FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = a.id ORDER BY b.popularity_score DESC LIMIT 1) knownFor,
       (SELECT count(*) FROM book_authors ba WHERE ba.author_id = a.id) bookCount
     FROM authors a WHERE ${where} ORDER BY a.popularity DESC LIMIT ?`,
    ...terms.map((t) => `%${t}%`), limit,
  );
}
