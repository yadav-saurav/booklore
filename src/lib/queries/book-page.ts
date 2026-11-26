import "server-only";
import { cache } from "react";
import { sqlite } from "@/db";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";

/* Data for /book/[id], /book/[id]/reviews and /book/[id]/ratings. */

export type BookAuthor = {
  id: string; name: string; photoId: number | null; photoUrl: string | null; bio: string | null;
  birthDate: string | null; deathDate: string | null; nationality: string | null;
};

export type BookDetail = {
  id: string; title: string; subtitle: string | null; year: number | null; coverId: number | null; coverUrl: string | null;
  isbn13: string | null; pages: number | null; publisher: string | null; language: string | null; synopsis: string | null;
  subjects: string[]; source: string; olWorkKey: string | null; googleId: string | null;
  ratingAvg: number | null; ratingCount: number; weightedScore: number | null; reviewCount: number; shelfCount: number;
  popularityRank: number | null; prevPopularityRank: number | null; olRatingAvg: number | null; olRatingCount: number;
  authors: BookAuthor[]; genres: { slug: string; name: string; kanji: string | null }[];
  authorName: string | null;
};

export const getBookDetail = cache((id: string): BookDetail | null => {
  const b = sqlite
    .prepare(
      `SELECT id, title, subtitle, first_publish_year year, cover_id coverId, cover_url coverUrl, isbn13, pages, publisher, language,
        synopsis, subjects, source, ol_work_key olWorkKey, google_id googleId, rating_avg ratingAvg, rating_count ratingCount,
        weighted_score weightedScore, review_count reviewCount, shelf_count shelfCount, popularity_rank popularityRank,
        prev_popularity_rank prevPopularityRank, ol_rating_avg olRatingAvg, ol_rating_count olRatingCount
       FROM books WHERE id = ?`,
    )
    .get(id) as (Omit<BookDetail, "subjects" | "authors" | "genres" | "authorName"> & { subjects: string }) | undefined;
  if (!b) return null;
  const authors = sqlite
    .prepare(
      `SELECT a.id, a.name, a.photo_id photoId, a.photo_url photoUrl, a.bio, a.birth_date birthDate, a.death_date deathDate, a.nationality
       FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = ? ORDER BY ba.position`,
    )
    .all(id) as BookAuthor[];
  const genres = sqlite
    .prepare(`SELECT g.slug, g.name, g.kanji FROM book_genres bg JOIN genres g ON g.slug = bg.genre_slug WHERE bg.book_id = ? ORDER BY g.position`)
    .all(id) as BookDetail["genres"];
  let subjects: string[] = [];
  try { subjects = JSON.parse(b.subjects || "[]"); } catch { /* keep empty */ }
  return { ...b, subjects, authors, genres, authorName: authors.map((a) => a.name).join(", ") || null };
});

export type ViewerState = { rating: number | null; status: "want" | "reading" | "read" | null; ratedAt: number | null };

export function getViewerState(userId: number | null | undefined, bookId: string): ViewerState {
  if (!userId) return { rating: null, status: null, ratedAt: null };
  const r = sqlite.prepare(`SELECT score, updated_at FROM ratings WHERE user_id = ? AND book_id = ?`).get(userId, bookId) as
    | { score: number; updated_at: number } | undefined;
  const s = sqlite.prepare(`SELECT status FROM shelf WHERE user_id = ? AND book_id = ?`).get(userId, bookId) as { status: ViewerState["status"] } | undefined;
  return { rating: r?.score ?? null, ratedAt: r?.updated_at ?? null, status: s?.status ?? null };
}

/* ───────────── Ratings ───────────── */

export type RatingStats = {
  counts: number[]; // index 0 → score 1 … index 9 → score 10
  total: number; mean: number | null; median: number | null; stdDev: number | null;
};

export function getRatingStats(bookId: string): RatingStats {
  const rows = sqlite.prepare(`SELECT score, count(*) n FROM ratings WHERE book_id = ? GROUP BY score`).all(bookId) as { score: number; n: number }[];
  const counts = Array.from({ length: 10 }, () => 0);
  for (const r of rows) if (r.score >= 1 && r.score <= 10) counts[r.score - 1] = r.n;
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return { counts, total, mean: null, median: null, stdDev: null };
  const mean = counts.reduce((s, n, i) => s + n * (i + 1), 0) / total;
  const variance = counts.reduce((s, n, i) => s + n * (i + 1 - mean) ** 2, 0) / total;
  const at = (k: number) => { let c = 0; for (let i = 0; i < 10; i++) { c += counts[i]; if (c > k) return i + 1; } return 10; };
  const median = total % 2 ? at((total - 1) / 2) : (at(total / 2 - 1) + at(total / 2)) / 2;
  return { counts, total, mean, median, stdDev: Math.sqrt(variance) };
}

export function getRatingsByYear(bookId: string): { year: number; count: number; avg: number }[] {
  return sqlite
    .prepare(
      `SELECT CAST(strftime('%Y', created_at, 'unixepoch') AS INTEGER) year, count(*) count, avg(score) avg
       FROM ratings WHERE book_id = ? GROUP BY year ORDER BY year`,
    )
    .all(bookId) as never;
}

export function getCatalogMean(): number {
  return (sqlite.prepare(`SELECT avg(score) m FROM ratings`).get() as { m: number | null }).m ?? 7;
}

/* ───────────── Reviews ───────────── */

export type ReviewItem = {
  id: number; bookId: string; headline: string; body: string; spoiler: boolean; helpfulCount: number; unhelpfulCount: number;
  createdAt: number; updatedAt: number; userId: number; username: string; displayName: string; avatarHue: number;
  rating: number | null; myVote: 1 | 0 | null; mine: boolean; reported: boolean;
};

export type ReviewSort = "helpful" | "date" | "rating-high" | "rating-low";

const REVIEW_SELECT = (viewer: number) => `
  SELECT r.id, r.book_id bookId, r.headline, r.body, r.spoiler, r.helpful_count helpfulCount, r.unhelpful_count unhelpfulCount,
    r.created_at createdAt, r.updated_at updatedAt, u.id userId, u.username, u.display_name displayName, u.avatar_hue avatarHue,
    (SELECT score FROM ratings rt WHERE rt.user_id = r.user_id AND rt.book_id = r.book_id) rating,
    (SELECT helpful FROM review_votes v WHERE v.review_id = r.id AND v.user_id = ${viewer}) myVote,
    EXISTS (SELECT 1 FROM review_reports rr WHERE rr.review_id = r.id AND rr.user_id = ${viewer}) reported,
    (r.user_id = ${viewer}) mine
  FROM reviews r JOIN users u ON u.id = r.user_id`;

type RawReview = Omit<ReviewItem, "spoiler" | "mine" | "reported"> & { spoiler: number; mine: number; reported: number };
const toReview = (r: RawReview): ReviewItem => ({ ...r, spoiler: !!r.spoiler, mine: !!r.mine, reported: !!r.reported });

const ORDER: Record<ReviewSort, string> = {
  helpful: `(r.helpful_count - r.unhelpful_count * 0.5) DESC, r.created_at DESC`,
  date: `r.created_at DESC`,
  "rating-high": `rating DESC NULLS LAST, r.helpful_count DESC`,
  "rating-low": `rating ASC NULLS LAST, r.helpful_count DESC`,
};

export function getReviews(
  bookId: string,
  opts: { sort?: ReviewSort; rating?: number | null; hideSpoilers?: boolean; limit?: number; offset?: number; viewerId?: number | null },
): { items: ReviewItem[]; total: number } {
  const viewer = Math.trunc(opts.viewerId ?? 0);
  const where = [`r.book_id = ?`];
  const params: unknown[] = [bookId];
  if (opts.hideSpoilers) where.push(`r.spoiler = 0`);
  if (opts.rating) {
    where.push(`(SELECT score FROM ratings rt WHERE rt.user_id = r.user_id AND rt.book_id = r.book_id) = ?`);
    params.push(opts.rating);
  }
  const w = where.join(" AND ");
  const total = (sqlite.prepare(`SELECT count(*) n FROM reviews r WHERE ${w}`).get(...params) as { n: number }).n;
  const items = (sqlite
    .prepare(`${REVIEW_SELECT(viewer)} WHERE ${w} ORDER BY ${ORDER[opts.sort ?? "helpful"]} LIMIT ? OFFSET ?`)
    .all(...params, opts.limit ?? 10, opts.offset ?? 0) as RawReview[]).map(toReview);
  return { items, total };
}

export function getMyReview(bookId: string, userId: number | null | undefined): ReviewItem | null {
  if (!userId) return null;
  const r = sqlite.prepare(`${REVIEW_SELECT(Math.trunc(userId))} WHERE r.book_id = ? AND r.user_id = ?`).get(bookId, userId) as RawReview | undefined;
  return r ? toReview(r) : null;
}

/** Counts per reviewer rating, for the filter chips on the reviews page. */
export function getReviewRatingCounts(bookId: string): Record<number, number> {
  const rows = sqlite
    .prepare(
      `SELECT rt.score s, count(*) n FROM reviews r JOIN ratings rt ON rt.user_id = r.user_id AND rt.book_id = r.book_id
       WHERE r.book_id = ? GROUP BY rt.score`,
    )
    .all(bookId) as { s: number; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.s, r.n]));
}

/* ───────────── Related ───────────── */

export function getOtherBooksByAuthor(authorId: string, excludeId: string, limit = 6): BookCard[] {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b JOIN book_authors ba ON ba.book_id = b.id
     WHERE ba.author_id = ? AND b.id != ? ORDER BY b.popularity_rank ASC NULLS LAST LIMIT ?`,
    authorId, excludeId, limit,
  );
}

export type ListMention = { id: number; title: string; description: string; itemCount: number; likeCount: number; ownerName: string; ownerUsername: string; coverBooks: BookCard[] };

export function getListsContaining(bookId: string, limit = 4): { items: ListMention[]; total: number } {
  const total = (sqlite
    .prepare(`SELECT count(*) n FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.book_id = ? AND l.is_public = 1`)
    .get(bookId) as { n: number }).n;
  const rows = sqlite
    .prepare(
      `SELECT l.id, l.title, l.description, l.like_count likeCount, u.display_name ownerName, u.username ownerUsername,
        (SELECT count(*) FROM list_items x WHERE x.list_id = l.id) itemCount
       FROM list_items li JOIN lists l ON l.id = li.list_id JOIN users u ON u.id = l.user_id
       WHERE li.book_id = ? AND l.is_public = 1 ORDER BY l.is_featured DESC, l.like_count DESC LIMIT ?`,
    )
    .all(bookId, limit) as Omit<ListMention, "coverBooks">[];
  const items = rows.map((l) => ({
    ...l,
    coverBooks: queryCards(
      `SELECT ${CARD_COLUMNS} FROM list_items li JOIN books b ON b.id = li.book_id WHERE li.list_id = ? ORDER BY li.position LIMIT 3`,
      l.id,
    ),
  }));
  return { items, total };
}

export function getListCountForBook(bookId: string): number {
  return (sqlite.prepare(`SELECT count(*) n FROM shelf WHERE book_id = ? AND status = 'want'`).get(bookId) as { n: number }).n;
}

/** Book's rank inside each of its genres (by weighted score), for the "More to explore" rail. */
export function getGenreRanks(bookId: string): { slug: string; name: string; rank: number | null; total: number }[] {
  return sqlite
    .prepare(
      `SELECT g.slug, g.name,
        (SELECT count(*) FROM book_genres x WHERE x.genre_slug = g.slug) total,
        (SELECT rnk FROM (SELECT bg.book_id, row_number() OVER (ORDER BY b.weighted_score DESC NULLS LAST, b.id) rnk
           FROM book_genres bg JOIN books b ON b.id = bg.book_id WHERE bg.genre_slug = g.slug) WHERE book_id = ?) rank
       FROM book_genres bg JOIN genres g ON g.slug = bg.genre_slug WHERE bg.book_id = ? ORDER BY g.position`,
    )
    .all(bookId, bookId) as never;
}

export function getTopRank(bookId: string): number | null {
  const r = sqlite
    .prepare(
      `SELECT rnk FROM (SELECT id, row_number() OVER (ORDER BY weighted_score DESC) rnk FROM books
        WHERE weighted_score IS NOT NULL AND rating_count >= 25) WHERE id = ?`,
    )
    .get(bookId) as { rnk: number } | undefined;
  return r && r.rnk <= 250 ? r.rnk : null;
}

export function getExploreGenres(exclude: string[], limit = 6): { slug: string; name: string; kanji: string | null }[] {
  const ph = exclude.length ? `WHERE slug NOT IN (${exclude.map(() => "?").join(",")})` : "";
  return sqlite.prepare(`SELECT slug, name, kanji FROM genres ${ph} ORDER BY position LIMIT ?`).all(...exclude, limit) as never;
}
