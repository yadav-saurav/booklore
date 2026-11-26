import "server-only";
import { db } from "@/db";
import { TOP_MIN_VOTES } from "@/lib/aggregates";
import { CARD_COLUMNS, queryCards, type BookCard } from "./books";

export const TOP_LIMIT = 250;
export const POPULAR_LIMIT = 100;
export const NEW_PAGE_SIZE = 50;
export const NEW_WINDOW_YEARS = 4; // "last 4 years" inclusive of the current year

export type ChartBook = BookCard & { chartRank: number };

/** Sort keys for the Top 250 table. `expr` may reference the ranked alias `r`. */
export const TOP_SORTS = {
  ranking: { expr: "r.rnk", dir: "asc", label: "Ranking" },
  rating: { expr: "b.rating_avg", dir: "desc", label: "Rating" },
  votes: { expr: "b.rating_count", dir: "desc", label: "Number of ratings" },
  year: { expr: "b.first_publish_year", dir: "desc", label: "Year" },
  title: { expr: "lower(b.title)", dir: "asc", label: "Title" },
  pages: { expr: "b.pages", dir: "desc", label: "Pages" },
} as const;
export type TopSort = keyof typeof TOP_SORTS;

export function parseTopSort(v: string | undefined): TopSort {
  return v && v in TOP_SORTS ? (v as TopSort) : "ranking";
}

/**
 * BOOKLORE Top 250: books with at least TOP_MIN_VOTES ratings, ranked by the Bayesian weighted
 * score. The global rank is computed before the genre filter, so a genre view keeps real ranks.
 */
export async function getTopRated(opts: { sort: TopSort; dir?: "asc" | "desc"; genre?: string | null }): Promise<ChartBook[]> {
  const s = TOP_SORTS[opts.sort];
  const d = (opts.dir ?? s.dir) === "asc" ? "ASC" : "DESC";
  const genreClause = opts.genre
    ? `AND EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_slug = ?)`
    : "";
  const params: unknown[] = [TOP_MIN_VOTES, TOP_LIMIT];
  if (opts.genre) params.push(opts.genre);
  const rows = await queryCards(
    `WITH ranked AS (
       SELECT id, row_number() OVER (ORDER BY weighted_score DESC NULLS LAST, rating_count DESC, id) AS rnk
       FROM books WHERE rating_count >= ? AND weighted_score IS NOT NULL
     )
     SELECT ${CARD_COLUMNS}, r.rnk AS chartRank
     FROM ranked r JOIN books b ON b.id = r.id
     WHERE r.rnk <= ? ${genreClause}
     ORDER BY ${s.expr} ${d} NULLS LAST, r.rnk ASC`,
    ...params,
  );
  return rows as ChartBook[];
}

/** BookMeter: the top books by popularity_rank, with previous rank for the movement arrows. */
export async function getMostPopular(limit = POPULAR_LIMIT): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b
     WHERE b.popularity_rank IS NOT NULL AND b.popularity_rank <= ?
     ORDER BY b.popularity_rank ASC LIMIT ?`,
    limit, limit,
  );
}

/** Years offered by the New & Notable filter, newest first. */
export function newYearOptions(now = new Date().getFullYear()): number[] {
  return Array.from({ length: NEW_WINDOW_YEARS }, (_, i) => now - i);
}

export async function getNewAndNotable(opts: { year?: number | null; offset?: number; limit?: number; now?: number } = {}): Promise<BookCard[]> {
  const now = opts.now ?? new Date().getFullYear();
  const { from, to } = { from: now - NEW_WINDOW_YEARS + 1, to: now };
  const yearClause = opts.year ? "AND b.first_publish_year = ?" : "";
  const params: unknown[] = [from, to];
  if (opts.year) params.push(opts.year);
  params.push(opts.limit ?? NEW_PAGE_SIZE, opts.offset ?? 0);
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b
     WHERE b.first_publish_year BETWEEN ? AND ? ${yearClause}
     ORDER BY b.popularity_score DESC, b.id ASC LIMIT ? OFFSET ?`,
    ...params,
  );
}

export async function countNewAndNotable(opts: { year?: number | null; now?: number } = {}): Promise<number> {
  const now = opts.now ?? new Date().getFullYear();
  const yearClause = opts.year ? "AND first_publish_year = ?" : "";
  const params: unknown[] = [now - NEW_WINDOW_YEARS + 1, now];
  if (opts.year) params.push(opts.year);
  return (await db.get<{ n: number }>(`SELECT count(*) n FROM books WHERE first_publish_year BETWEEN ? AND ? ${yearClause}`, ...params))?.n ?? 0;
}

/** Catalog mean rating, shown in the "how is this ranked" explainer. */
export async function catalogMean(): Promise<number> {
  return (await db.get<{ m: number | null }>(`SELECT avg(score) m FROM ratings`))?.m ?? 7;
}
