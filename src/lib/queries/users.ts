import "server-only";
import { sqlite } from "@/db";
import { CARD_COLUMNS, toCard, getGenres, type BookCard } from "@/lib/queries/books";
import type { ShelfStatus } from "@/db/schema";

/* ───────────── Users ───────────── */

export type MemberRow = {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  location: string | null;
  avatarHue: number;
  isMock: boolean;
  createdAt: number;
};

const USER_COLUMNS = `id, username, display_name displayName, bio, location, avatar_hue avatarHue, is_mock isMock, created_at createdAt`;
const asMember = (r: unknown): MemberRow | null => {
  if (!r) return null;
  const row = r as Omit<MemberRow, "isMock"> & { isMock: number };
  return { ...row, isMock: !!row.isMock };
};

export function getMemberByUsername(username: string): MemberRow | null {
  return asMember(sqlite.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`).get(username.toLowerCase())) ;
}

export function getMemberById(id: number): MemberRow | null {
  return asMember(sqlite.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id));
}

/** Account-only fields (email) for the settings page. */
export function getAccount(id: number): (MemberRow & { email: string | null }) | null {
  const r = sqlite.prepare(`SELECT ${USER_COLUMNS}, email FROM users WHERE id = ?`).get(id);
  return asMember(r) as (MemberRow & { email: string | null }) | null;
}

export function getProfileStats(userId: number, includePrivate: boolean) {
  const n = (sql: string) => (sqlite.prepare(sql).get(userId) as { n: number }).n;
  return {
    ratings: n(`SELECT count(*) n FROM ratings WHERE user_id = ?`),
    reviews: n(`SELECT count(*) n FROM reviews WHERE user_id = ?`),
    lists: n(`SELECT count(*) n FROM lists WHERE user_id = ? ${includePrivate ? "" : "AND is_public = 1"}`),
    read: n(`SELECT count(*) n FROM shelf WHERE user_id = ? AND status = 'read'`),
  };
}

export function getFollowCounts(userId: number) {
  const r = sqlite
    .prepare(`SELECT
      (SELECT count(*) FROM follows WHERE followee_id = ?) AS followers,
      (SELECT count(*) FROM follows WHERE follower_id = ?) AS following`)
    .get(userId, userId) as { followers: number; following: number };
  return r;
}

export function isFollowing(viewerId: number, targetId: number): boolean {
  return !!sqlite.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`).get(viewerId, targetId);
}

/** Favourite genres: genres most present in the member's 7+ ratings (falls back to all ratings). */
export function favoriteGenres(userId: number, limit = 5): { slug: string; name: string; count: number }[] {
  const q = (min: number) =>
    sqlite
      .prepare(`SELECT g.slug, g.name, count(*) count
        FROM ratings r JOIN book_genres bg ON bg.book_id = r.book_id JOIN genres g ON g.slug = bg.genre_slug
        WHERE r.user_id = ? AND r.score >= ? GROUP BY g.slug ORDER BY count DESC, g.name LIMIT ?`)
      .all(userId, min, limit) as { slug: string; name: string; count: number }[];
  const liked = q(7);
  return liked.length ? liked : q(1);
}

/* ───────────── Ratings ───────────── */

export type Histogram = { score: number; count: number }[]; // always 1..10

export function ratingHistogram(userId: number, genre?: string | null): Histogram {
  const rows = sqlite
    .prepare(`SELECT r.score score, count(*) count FROM ratings r
      WHERE r.user_id = ? ${genre ? "AND EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = r.book_id AND g.genre_slug = ?)" : ""}
      GROUP BY r.score`)
    .all(...(genre ? [userId, genre] : [userId])) as { score: number; count: number }[];
  return Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: rows.find((r) => r.score === i + 1)?.count ?? 0 }));
}

export type RatedBook = BookCard & { yourRating: number; ratedAt: number };

export const RATING_SORTS = {
  date: "r.updated_at DESC, b.title",
  score: "r.score DESC, b.title",
  booklore: "b.rating_avg IS NULL, b.rating_avg DESC, b.title",
  title: "b.title COLLATE NOCASE ASC",
  year: "b.first_publish_year IS NULL, b.first_publish_year DESC, b.title",
} as const;
export type RatingSort = keyof typeof RATING_SORTS;

export function getUserRatings(userId: number, opts: { sort?: RatingSort; genre?: string | null; limit?: number } = {}): RatedBook[] {
  const order = RATING_SORTS[opts.sort ?? "date"];
  const rows = sqlite
    .prepare(`SELECT ${CARD_COLUMNS}, r.score AS yourRating, r.updated_at AS ratedAt
      FROM ratings r JOIN books b ON b.id = r.book_id
      WHERE r.user_id = ? ${opts.genre ? "AND EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = b.id AND g.genre_slug = ?)" : ""}
      ORDER BY ${order} LIMIT ?`)
    .all(...(opts.genre ? [userId, opts.genre, opts.limit ?? 100000] : [userId, opts.limit ?? 100000])) as (Parameters<typeof toCard>[0] & { yourRating: number; ratedAt: number })[];
  return rows.map((r) => ({ ...toCard(r), yourRating: r.yourRating, ratedAt: r.ratedAt }));
}

/* ───────────── Reading list (shelf) ───────────── */

export type ShelfItem = BookCard & { status: ShelfStatus; progress: number | null; addedAt: number; yourRating: number | null };

export const SHELF_SORTS = {
  added: "s.added_at DESC, b.title",
  title: "b.title COLLATE NOCASE ASC",
  rating: "b.rating_avg IS NULL, b.rating_avg DESC, b.title",
  popularity: "b.popularity_rank IS NULL, b.popularity_rank ASC",
  year: "b.first_publish_year IS NULL, b.first_publish_year DESC, b.title",
  pages: "b.pages IS NULL, b.pages DESC, b.title",
} as const;
export type ShelfSort = keyof typeof SHELF_SORTS;

export function getShelf(userId: number, status: ShelfStatus, opts: { sort?: ShelfSort; genre?: string | null } = {}): ShelfItem[] {
  const order = SHELF_SORTS[opts.sort ?? "added"];
  const rows = sqlite
    .prepare(`SELECT ${CARD_COLUMNS}, s.status AS status, s.progress AS progress, s.added_at AS addedAt, r.score AS yourRating
      FROM shelf s JOIN books b ON b.id = s.book_id
      LEFT JOIN ratings r ON r.user_id = s.user_id AND r.book_id = s.book_id
      WHERE s.user_id = ? AND s.status = ? ${opts.genre ? "AND EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = b.id AND g.genre_slug = ?)" : ""}
      ORDER BY ${order}`)
    .all(...(opts.genre ? [userId, status, opts.genre] : [userId, status])) as (Parameters<typeof toCard>[0] & {
      status: ShelfStatus; progress: number | null; addedAt: number; yourRating: number | null;
    })[];
  return rows.map((r) => ({ ...toCard(r), status: r.status, progress: r.progress, addedAt: r.addedAt, yourRating: r.yourRating }));
}

export function getShelfCounts(userId: number): Record<ShelfStatus, number> {
  const out: Record<ShelfStatus, number> = { want: 0, reading: 0, read: 0 };
  for (const r of sqlite.prepare(`SELECT status, count(*) n FROM shelf WHERE user_id = ? GROUP BY status`).all(userId) as { status: ShelfStatus; n: number }[])
    out[r.status] = r.n;
  return out;
}

/* ───────────── Reviews ───────────── */

export type ReviewItem = {
  reviewId: number;
  headline: string;
  body: string;
  spoiler: boolean;
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: number;
  userId: number;
  username: string;
  displayName: string;
  avatarHue: number;
  reviewerRating: number | null;
  book: BookCard;
};

export const REVIEW_SORTS = ["latest", "helpful"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

function reviewWhere(opts: { userId?: number; genre?: string | null; sort?: ReviewSort }) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.userId) { clauses.push("rv.user_id = ?"); params.push(opts.userId); }
  if (opts.genre) {
    clauses.push("EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = rv.book_id AND g.genre_slug = ?)");
    params.push(opts.genre);
  }
  if (opts.sort === "helpful") clauses.push("rv.created_at >= unixepoch() - 30 * 86400");
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export function getReviews(opts: { userId?: number; genre?: string | null; sort?: ReviewSort; limit?: number; offset?: number } = {}): ReviewItem[] {
  const { where, params } = reviewWhere(opts);
  const order = opts.sort === "helpful" ? "rv.helpful_count DESC, rv.created_at DESC" : "rv.created_at DESC";
  const rows = sqlite
    .prepare(`SELECT ${CARD_COLUMNS}, rv.id AS reviewId, rv.headline, rv.body, rv.spoiler, rv.helpful_count AS helpfulCount,
        rv.unhelpful_count AS unhelpfulCount, rv.created_at AS createdAt,
        u.id AS userId, u.username, u.display_name AS displayName, u.avatar_hue AS avatarHue,
        (SELECT score FROM ratings r WHERE r.user_id = rv.user_id AND r.book_id = rv.book_id) AS reviewerRating
      FROM reviews rv JOIN books b ON b.id = rv.book_id JOIN users u ON u.id = rv.user_id
      ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, opts.limit ?? 20, opts.offset ?? 0) as (Parameters<typeof toCard>[0] & {
      reviewId: number; headline: string; body: string; spoiler: number; helpfulCount: number; unhelpfulCount: number;
      createdAt: number; userId: number; username: string; displayName: string; avatarHue: number; reviewerRating: number | null;
    })[];
  return rows.map((r) => ({
    reviewId: r.reviewId, headline: r.headline, body: r.body, spoiler: !!r.spoiler, helpfulCount: r.helpfulCount,
    unhelpfulCount: r.unhelpfulCount, createdAt: r.createdAt, userId: r.userId, username: r.username,
    displayName: r.displayName, avatarHue: r.avatarHue, reviewerRating: r.reviewerRating, book: toCard(r),
  }));
}

export function countReviews(opts: { userId?: number; genre?: string | null; sort?: ReviewSort } = {}): number {
  const { where, params } = reviewWhere(opts);
  return (sqlite.prepare(`SELECT count(*) n FROM reviews rv ${where}`).get(...params) as { n: number }).n;
}

/* ───────────── Community ───────────── */

export type MemberCard = { id: number; username: string; displayName: string; avatarHue: number; isMock: boolean; bio: string };

export function topReviewers(limit = 10) {
  return sqlite
    .prepare(`SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue, u.is_mock isMock, u.bio,
        count(rv.id) AS reviews, coalesce(sum(rv.helpful_count), 0) AS helpful
      FROM users u JOIN reviews rv ON rv.user_id = u.id
      GROUP BY u.id ORDER BY reviews DESC, helpful DESC, u.username LIMIT ?`)
    .all(limit) as (MemberCard & { reviews: number; helpful: number })[];
}

export function mostFollowed(limit = 10) {
  return sqlite
    .prepare(`SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue, u.is_mock isMock, u.bio,
        count(f.follower_id) AS followers
      FROM users u JOIN follows f ON f.followee_id = u.id
      GROUP BY u.id ORDER BY followers DESC, u.username LIMIT ?`)
    .all(limit) as (MemberCard & { followers: number })[];
}

export function recentlyActive(limit = 12) {
  return sqlite
    .prepare(`SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue, u.is_mock isMock, u.bio,
        max(a.ts) AS lastActive
      FROM users u JOIN (
        SELECT user_id, updated_at ts FROM ratings
        UNION ALL SELECT user_id, updated_at FROM reviews
        UNION ALL SELECT user_id, updated_at FROM shelf
        UNION ALL SELECT user_id, updated_at FROM lists WHERE is_public = 1
      ) a ON a.user_id = u.id
      GROUP BY u.id ORDER BY lastActive DESC, u.username LIMIT ?`)
    .all(limit) as (MemberCard & { lastActive: number })[];
}

/** Books rated/shelved by a user (for recomputing aggregates before deleting an account). */
export function touchedBookIds(userId: number): string[] {
  return (sqlite
    .prepare(`SELECT book_id id FROM ratings WHERE user_id = ? UNION SELECT book_id FROM shelf WHERE user_id = ?`)
    .all(userId, userId) as { id: string }[]).map((r) => r.id);
}

export { getGenres };
export type { ShelfStatus };
