import "server-only";
import { db } from "@/db";
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

export async function getMemberByUsername(username: string): Promise<MemberRow | null> {
  return asMember(await db.get(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`, username.toLowerCase()));
}

export async function getMemberById(id: number): Promise<MemberRow | null> {
  return asMember(await db.get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, id));
}

/** Account-only fields (email) for the settings page. */
export async function getAccount(id: number): Promise<(MemberRow & { email: string | null }) | null> {
  const r = await db.get(`SELECT ${USER_COLUMNS}, email FROM users WHERE id = ?`, id);
  return asMember(r) as (MemberRow & { email: string | null }) | null;
}

export async function getProfileStats(userId: number, includePrivate: boolean) {
  const r = await db.get<{ ratings: number; reviews: number; lists: number; read: number }>(`SELECT
    (SELECT count(*) FROM ratings WHERE user_id = ?) AS ratings,
    (SELECT count(*) FROM reviews WHERE user_id = ?) AS reviews,
    (SELECT count(*) FROM lists WHERE user_id = ? ${includePrivate ? "" : "AND is_public = 1"}) AS lists,
    (SELECT count(*) FROM shelf WHERE user_id = ? AND status = 'read') AS read`, userId, userId, userId, userId);
  return r!;
}

export async function getFollowCounts(userId: number) {
  const r = await db.get<{ followers: number; following: number }>(`SELECT
      (SELECT count(*) FROM follows WHERE followee_id = ?) AS followers,
      (SELECT count(*) FROM follows WHERE follower_id = ?) AS following`, userId, userId);
  return r!;
}

export async function isFollowing(viewerId: number, targetId: number): Promise<boolean> {
  return !!(await db.get(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`, viewerId, targetId));
}

/** Favourite genres: genres most present in the member's 7+ ratings (falls back to all ratings). */
export async function favoriteGenres(userId: number, limit = 5): Promise<{ slug: string; name: string; count: number }[]> {
  const q = (min: number) =>
    db.all<{ slug: string; name: string; count: number }>(`SELECT g.slug, g.name, count(*) AS count
        FROM ratings r JOIN book_genres bg ON bg.book_id = r.book_id JOIN genres g ON g.slug = bg.genre_slug
        WHERE r.user_id = ? AND r.score >= ? GROUP BY g.slug ORDER BY count(*) DESC, g.name LIMIT ?`, userId, min, limit);
  const liked = await q(7);
  return liked.length ? liked : q(1);
}

/* ───────────── Ratings ───────────── */

export type Histogram = { score: number; count: number }[]; // always 1..10

export async function ratingHistogram(userId: number, genre?: string | null): Promise<Histogram> {
  const rows = await db.all<{ score: number; count: number }>(`SELECT r.score AS score, count(*) AS count FROM ratings r
      WHERE r.user_id = ? ${genre ? "AND EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = r.book_id AND g.genre_slug = ?)" : ""}
      GROUP BY r.score`, ...(genre ? [userId, genre] : [userId]));
  return Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: rows.find((r) => r.score === i + 1)?.count ?? 0 }));
}

export type RatedBook = BookCard & { yourRating: number; ratedAt: number };

export const RATING_SORTS = {
  date: "r.updated_at DESC, b.title",
  score: "r.score DESC, b.title",
  booklore: "b.rating_avg IS NULL, b.rating_avg DESC, b.title",
  title: "lower(b.title) ASC",
  year: "b.first_publish_year IS NULL, b.first_publish_year DESC, b.title",
} as const;
export type RatingSort = keyof typeof RATING_SORTS;

export async function getUserRatings(userId: number, opts: { sort?: RatingSort; genre?: string | null; limit?: number } = {}): Promise<RatedBook[]> {
  const order = RATING_SORTS[opts.sort ?? "date"];
  const rows = await db.all<Parameters<typeof toCard>[0] & { yourRating: number; ratedAt: number }>(`SELECT ${CARD_COLUMNS}, r.score AS yourRating, r.updated_at AS ratedAt
      FROM ratings r JOIN books b ON b.id = r.book_id
      WHERE r.user_id = ? ${opts.genre ? "AND EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = b.id AND g.genre_slug = ?)" : ""}
      ORDER BY ${order} LIMIT ?`, ...(opts.genre ? [userId, opts.genre, opts.limit ?? 100000] : [userId, opts.limit ?? 100000]));
  return rows.map((r) => ({ ...toCard(r), yourRating: r.yourRating, ratedAt: r.ratedAt }));
}

/* ───────────── Reading list (shelf) ───────────── */

export type ShelfItem = BookCard & { status: ShelfStatus; progress: number | null; addedAt: number; yourRating: number | null };

export const SHELF_SORTS = {
  added: "s.added_at DESC, b.title",
  title: "lower(b.title) ASC",
  rating: "b.rating_avg IS NULL, b.rating_avg DESC, b.title",
  popularity: "b.popularity_rank IS NULL, b.popularity_rank ASC",
  year: "b.first_publish_year IS NULL, b.first_publish_year DESC, b.title",
  pages: "b.pages IS NULL, b.pages DESC, b.title",
} as const;
export type ShelfSort = keyof typeof SHELF_SORTS;

export async function getShelf(userId: number, status: ShelfStatus, opts: { sort?: ShelfSort; genre?: string | null } = {}): Promise<ShelfItem[]> {
  const order = SHELF_SORTS[opts.sort ?? "added"];
  const rows = await db.all<Parameters<typeof toCard>[0] & {
      status: ShelfStatus; progress: number | null; addedAt: number; yourRating: number | null;
    }>(`SELECT ${CARD_COLUMNS}, s.status AS status, s.progress AS progress, s.added_at AS addedAt, r.score AS yourRating
      FROM shelf s JOIN books b ON b.id = s.book_id
      LEFT JOIN ratings r ON r.user_id = s.user_id AND r.book_id = s.book_id
      WHERE s.user_id = ? AND s.status = ? ${opts.genre ? "AND EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = b.id AND g.genre_slug = ?)" : ""}
      ORDER BY ${order}`, ...(opts.genre ? [userId, status, opts.genre] : [userId, status]));
  return rows.map((r) => ({ ...toCard(r), status: r.status, progress: r.progress, addedAt: r.addedAt, yourRating: r.yourRating }));
}

export async function getShelfCounts(userId: number): Promise<Record<ShelfStatus, number>> {
  const out: Record<ShelfStatus, number> = { want: 0, reading: 0, read: 0 };
  for (const r of await db.all<{ status: ShelfStatus; n: number }>(`SELECT status, count(*) AS n FROM shelf WHERE user_id = ? GROUP BY status`, userId))
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

export async function getReviews(opts: { userId?: number; genre?: string | null; sort?: ReviewSort; limit?: number; offset?: number } = {}): Promise<ReviewItem[]> {
  const { where, params } = reviewWhere(opts);
  const order = opts.sort === "helpful" ? "rv.helpful_count DESC, rv.created_at DESC" : "rv.created_at DESC";
  const rows = await db.all<Parameters<typeof toCard>[0] & {
      reviewId: number; headline: string; body: string; spoiler: number; helpfulCount: number; unhelpfulCount: number;
      createdAt: number; userId: number; username: string; displayName: string; avatarHue: number; reviewerRating: number | null;
    }>(`SELECT ${CARD_COLUMNS}, rv.id AS reviewId, rv.headline, rv.body, rv.spoiler, rv.helpful_count AS helpfulCount,
        rv.unhelpful_count AS unhelpfulCount, rv.created_at AS createdAt,
        u.id AS userId, u.username, u.display_name AS displayName, u.avatar_hue AS avatarHue,
        (SELECT score FROM ratings r WHERE r.user_id = rv.user_id AND r.book_id = rv.book_id) AS reviewerRating
      FROM reviews rv JOIN books b ON b.id = rv.book_id JOIN users u ON u.id = rv.user_id
      ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, ...params, opts.limit ?? 20, opts.offset ?? 0);
  return rows.map((r) => ({
    reviewId: r.reviewId, headline: r.headline, body: r.body, spoiler: !!r.spoiler, helpfulCount: r.helpfulCount,
    unhelpfulCount: r.unhelpfulCount, createdAt: r.createdAt, userId: r.userId, username: r.username,
    displayName: r.displayName, avatarHue: r.avatarHue, reviewerRating: r.reviewerRating, book: toCard(r),
  }));
}

export async function countReviews(opts: { userId?: number; genre?: string | null; sort?: ReviewSort } = {}): Promise<number> {
  const { where, params } = reviewWhere(opts);
  return (await db.get<{ n: number }>(`SELECT count(*) AS n FROM reviews rv ${where}`, ...params))!.n;
}

/* ───────────── Community ───────────── */

export type MemberCard = { id: number; username: string; displayName: string; avatarHue: number; isMock: boolean; bio: string };

export async function topReviewers(limit = 10) {
  return db.all<(MemberCard & { reviews: number; helpful: number })>(`SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue, u.is_mock isMock, u.bio,
        count(rv.id) AS reviews, coalesce(sum(rv.helpful_count), 0) AS helpful
      FROM users u JOIN reviews rv ON rv.user_id = u.id
      GROUP BY u.id ORDER BY count(rv.id) DESC, coalesce(sum(rv.helpful_count), 0) DESC, u.username LIMIT ?`, limit);

}

export async function mostFollowed(limit = 10) {
  return db.all<(MemberCard & { followers: number })>(`SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue, u.is_mock isMock, u.bio,
        count(f.follower_id) AS followers
      FROM users u JOIN follows f ON f.followee_id = u.id
      GROUP BY u.id ORDER BY count(f.follower_id) DESC, u.username LIMIT ?`, limit);

}

export async function recentlyActive(limit = 12) {
  return db.all<(MemberCard & { lastActive: number })>(`SELECT u.id, u.username, u.display_name displayName, u.avatar_hue avatarHue, u.is_mock isMock, u.bio,
        max(a.ts) AS lastActive
      FROM users u JOIN (
        SELECT user_id, updated_at ts FROM ratings
        UNION ALL SELECT user_id, updated_at FROM reviews
        UNION ALL SELECT user_id, updated_at FROM shelf
        UNION ALL SELECT user_id, updated_at FROM lists WHERE is_public = 1
      ) a ON a.user_id = u.id
      GROUP BY u.id ORDER BY max(a.ts) DESC, u.username LIMIT ?`, limit);

}

/** Books rated/shelved by a user (for recomputing aggregates before deleting an account). */
export async function touchedBookIds(userId: number): Promise<string[]> {
  return (await db.all<{ id: string }>(`SELECT book_id AS id FROM ratings WHERE user_id = ? UNION SELECT book_id FROM shelf WHERE user_id = ?`, userId, userId)).map((r) => r.id);
}

export { getGenres };
export type { ShelfStatus };
