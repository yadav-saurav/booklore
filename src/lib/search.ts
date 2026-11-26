import "server-only";
import { sqlite } from "@/db";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";

/** Turn free text into a safe FTS5 prefix query: `dune herb` → `"dune"* "herb"*`. */
export function ftsQuery(q: string): string | null {
  const terms = q.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]+/gu);
  if (!terms?.length) return null;
  return terms.slice(0, 8).map((t) => `"${t}"*`).join(" ");
}

/** Local catalog full-text search, ranked by bm25 blended with popularity. */
export function searchLocalBooks(q: string, limit = 20, offset = 0): BookCard[] {
  const fts = ftsQuery(q);
  if (!fts) return [];
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books_fts f JOIN books b ON b.id = f.book_id
     WHERE books_fts MATCH ?
     ORDER BY bm25(books_fts, 0, 10.0, 4.0, 6.0, 1.0) - ln(1 + b.popularity_score) * 0.6
     LIMIT ? OFFSET ?`,
    fts, limit, offset,
  );
}

export type AuthorHit = { id: string; name: string; photoId: number | null; birthDate: string | null; deathDate: string | null; knownFor: string | null; bookCount: number };

export function searchLocalAuthors(q: string, limit = 10): AuthorHit[] {
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const where = terms.map(() => `lower(a.name) LIKE ?`).join(" AND ");
  return sqlite
    .prepare(
      `SELECT a.id, a.name, a.photo_id photoId, a.birth_date birthDate, a.death_date deathDate,
        (SELECT b.title FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = a.id ORDER BY b.popularity_score DESC LIMIT 1) knownFor,
        (SELECT count(*) FROM book_authors ba WHERE ba.author_id = a.id) bookCount
       FROM authors a WHERE ${where} ORDER BY a.popularity DESC LIMIT ?`,
    )
    .all(...terms.map((t) => `%${t}%`), limit) as AuthorHit[];
}
