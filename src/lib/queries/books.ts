import "server-only";
import { sqlite } from "@/db";

/** The one card shape every rail, chart, grid and list renders. Keep queries returning this. */
export type BookCard = {
  id: string;
  title: string;
  year: number | null;
  coverId: number | null;
  coverUrl: string | null;
  authorId: string | null;
  authorName: string | null; // "A, B" for multi-author books
  ratingAvg: number | null;
  ratingCount: number;
  weightedScore: number | null;
  popularityRank: number | null;
  prevPopularityRank: number | null;
  pages: number | null;
  genres: string[]; // genre slugs
};

export type UserBookState = { rating: number | null; status: "want" | "reading" | "read" | null };

/** SELECT list producing BookCard columns from alias `b`. Use with `FROM books b`. */
export const CARD_COLUMNS = `
  b.id, b.title, b.first_publish_year AS year, b.cover_id AS coverId, b.cover_url AS coverUrl,
  (SELECT a.id FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id ORDER BY ba.position LIMIT 1) AS authorId,
  (SELECT group_concat(name, ', ') FROM (SELECT a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id ORDER BY ba.position)) AS authorName,
  b.rating_avg AS ratingAvg, b.rating_count AS ratingCount, b.weighted_score AS weightedScore,
  b.popularity_rank AS popularityRank, b.prev_popularity_rank AS prevPopularityRank, b.pages,
  (SELECT group_concat(genre_slug) FROM book_genres g WHERE g.book_id = b.id) AS genreCsv`;

type Row = Omit<BookCard, "genres"> & { genreCsv: string | null };
export const toCard = (r: Row): BookCard => {
  const { genreCsv, ...rest } = r;
  return { ...rest, genres: genreCsv ? genreCsv.split(",") : [] };
};

/** Run an arbitrary query that selects CARD_COLUMNS. */
export function queryCards(sql: string, ...params: unknown[]): BookCard[] {
  return (sqlite.prepare(sql).all(...params) as Row[]).map(toCard);
}

export function getCardsByIds(ids: string[]): BookCard[] {
  if (!ids.length) return [];
  const rows = queryCards(`SELECT ${CARD_COLUMNS} FROM books b WHERE b.id IN (${ids.map(() => "?").join(",")})`, ...ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as BookCard[];
}

/** Ratings + shelf status of the signed-in user for a set of books (for card ribbons and stars). */
export function getUserStates(userId: number | null | undefined, ids: string[]): Record<string, UserBookState> {
  const out: Record<string, UserBookState> = {};
  if (!userId || !ids.length) return out;
  const ph = ids.map(() => "?").join(",");
  for (const r of sqlite.prepare(`SELECT book_id, score FROM ratings WHERE user_id = ? AND book_id IN (${ph})`).all(userId, ...ids) as { book_id: string; score: number }[])
    out[r.book_id] = { rating: r.score, status: null };
  for (const r of sqlite.prepare(`SELECT book_id, status FROM shelf WHERE user_id = ? AND book_id IN (${ph})`).all(userId, ...ids) as { book_id: string; status: UserBookState["status"] }[])
    out[r.book_id] = { rating: out[r.book_id]?.rating ?? null, status: r.status };
  return out;
}

export function getGenres(): { slug: string; name: string; kanji: string | null; description: string; count: number }[] {
  return sqlite
    .prepare(`SELECT g.slug, g.name, g.kanji, g.description, (SELECT count(*) FROM book_genres bg WHERE bg.genre_slug = g.slug) count
              FROM genres g ORDER BY g.position`)
    .all() as never;
}
