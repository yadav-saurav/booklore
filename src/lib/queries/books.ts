import "server-only";
import { db } from "@/db";

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
  (SELECT string_agg(a.name, ', ' ORDER BY ba.position) FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id) AS authorName,
  b.rating_avg AS ratingAvg, b.rating_count AS ratingCount, b.weighted_score AS weightedScore,
  b.popularity_rank AS popularityRank, b.prev_popularity_rank AS prevPopularityRank, b.pages,
  (SELECT string_agg(genre_slug, ',') FROM book_genres g WHERE g.book_id = b.id) AS genreCsv`;

type Row = Omit<BookCard, "genres"> & { genreCsv: string | null };
export const toCard = (r: Row): BookCard => {
  const { genreCsv, ...rest } = r;
  return { ...rest, genres: genreCsv ? genreCsv.split(",") : [] };
};

/** Run an arbitrary query that selects CARD_COLUMNS. */
export async function queryCards(sql: string, ...params: unknown[]): Promise<BookCard[]> {
  return (await db.all<Row>(sql, ...params)).map(toCard);
}

export async function getCardsByIds(ids: string[]): Promise<BookCard[]> {
  if (!ids.length) return [];
  const rows = await queryCards(`SELECT ${CARD_COLUMNS} FROM books b WHERE b.id IN (${ids.map(() => "?").join(",")})`, ...ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as BookCard[];
}

/** Ratings + shelf status of the signed-in user for a set of books (for card ribbons and stars). */
export async function getUserStates(userId: number | null | undefined, ids: string[]): Promise<Record<string, UserBookState>> {
  const out: Record<string, UserBookState> = {};
  if (!userId || !ids.length) return out;
  const ph = ids.map(() => "?").join(",");
  for (const r of await db.all<{ book_id: string; score: number }>(`SELECT book_id, score FROM ratings WHERE user_id = ? AND book_id IN (${ph})`, userId, ...ids))
    out[r.book_id] = { rating: r.score, status: null };
  for (const r of await db.all<{ book_id: string; status: UserBookState["status"] }>(`SELECT book_id, status FROM shelf WHERE user_id = ? AND book_id IN (${ph})`, userId, ...ids))
    out[r.book_id] = { rating: out[r.book_id]?.rating ?? null, status: r.status };
  return out;
}

export async function getGenres(): Promise<{ slug: string; name: string; kanji: string | null; description: string; count: number }[]> {
  return db.all(`SELECT g.slug, g.name, g.kanji, g.description, (SELECT count(*) FROM book_genres bg WHERE bg.genre_slug = g.slug) count
                 FROM genres g ORDER BY g.position`);
}
