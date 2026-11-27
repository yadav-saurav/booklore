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

/* ───────────── Profile insights, badges, activity (IMDb profile + /you) ───────────── */

export type ProfileInsights = {
  ratings: number;
  average: number | null;
  histogram: Histogram;
  genres: { slug: string; name: string; count: number; pct: number }[];
  decades: { decade: number; count: number }[];
  pagesRead: number;
  booksRead: number;
};

export async function getProfileInsights(userId: number): Promise<ProfileInsights> {
  const [agg, histogram, genres, decades, pages] = await Promise.all([
    db.get<{ n: number; avg: number | null }>(`SELECT count(*) AS n, round(avg(score)::numeric, 1) AS avg FROM ratings WHERE user_id = ?`, userId),
    ratingHistogram(userId),
    db.all<{ slug: string; name: string; count: number }>(`SELECT g.slug, g.name, count(*) AS count
        FROM ratings r JOIN book_genres bg ON bg.book_id = r.book_id JOIN genres g ON g.slug = bg.genre_slug
        WHERE r.user_id = ? GROUP BY g.slug, g.name ORDER BY count(*) DESC, g.name LIMIT 6`, userId),
    db.all<{ decade: number; count: number }>(`SELECT CASE WHEN b.first_publish_year < 1900 THEN 0 ELSE (b.first_publish_year / 10) * 10 END AS decade, count(*) AS count
        FROM (SELECT book_id FROM ratings WHERE user_id = ? UNION SELECT book_id FROM shelf WHERE user_id = ? AND status = 'read') x
        JOIN books b ON b.id = x.book_id WHERE b.first_publish_year IS NOT NULL
        GROUP BY 1 ORDER BY 1`, userId, userId),
    db.get<{ pages: number | null; n: number }>(`SELECT sum(b.pages) AS pages, count(*) AS n FROM shelf s JOIN books b ON b.id = s.book_id
        WHERE s.user_id = ? AND s.status = 'read'`, userId),
  ]);
  const total = agg?.n ?? 0;
  return {
    ratings: total,
    average: agg?.avg ?? null,
    histogram,
    genres: genres.map((g) => ({ ...g, pct: total ? Math.round((g.count / total) * 100) : 0 })),
    decades,
    pagesRead: pages?.pages ?? 0,
    booksRead: pages?.n ?? 0,
  };
}

export type Badge = { key: "top-reviewer" | "ratings" | "critic" | "explorer" | "list-maker" | "early" | "reader"; label: string; detail: string };

/** IMDb-style computed badges. */
export async function getBadges(userId: number): Promise<Badge[]> {
  const r = await db.get<{
    helpfulRank: number | null; helpful: number; ratings: number; avg: number | null; genres: number; lists: number; joinRank: number; read: number;
  }>(`SELECT
      (SELECT x.rk FROM (SELECT user_id, rank() OVER (ORDER BY sum(helpful_count) DESC) AS rk FROM reviews GROUP BY user_id HAVING sum(helpful_count) > 0) x WHERE x.user_id = ?) AS helpfulRank,
      (SELECT coalesce(sum(helpful_count), 0) FROM reviews WHERE user_id = ?) AS helpful,
      (SELECT count(*) FROM ratings WHERE user_id = ?) AS ratings,
      (SELECT avg(score)::float8 FROM ratings WHERE user_id = ?) AS avg,
      (SELECT count(DISTINCT bg.genre_slug) FROM ratings r JOIN book_genres bg ON bg.book_id = r.book_id WHERE r.user_id = ?) AS genres,
      (SELECT count(*) FROM lists WHERE user_id = ? AND is_public = 1) AS lists,
      (SELECT count(*) FROM users u2 WHERE u2.created_at < (SELECT created_at FROM users WHERE id = ?) OR (u2.created_at = (SELECT created_at FROM users WHERE id = ?) AND u2.id < ?)) AS joinRank,
      (SELECT count(*) FROM shelf WHERE user_id = ? AND status = 'read') AS read`,
    userId, userId, userId, userId, userId, userId, userId, userId, userId, userId);
  if (!r) return [];
  const out: Badge[] = [];
  if (r.helpfulRank && r.helpfulRank <= 10) out.push({ key: "top-reviewer", label: "Top Reviewer", detail: `#${r.helpfulRank} by helpful votes · ${r.helpful.toLocaleString("en-US")}` });
  if (r.ratings >= 100) out.push({ key: "ratings", label: `${Math.floor(r.ratings / 100) * 100}+ Ratings`, detail: `${r.ratings.toLocaleString("en-US")} books rated` });
  else if (r.ratings >= 25) out.push({ key: "ratings", label: "25+ Ratings", detail: `${r.ratings} books rated` });
  if (r.avg !== null && r.ratings >= 10 && r.avg <= 6.5) out.push({ key: "critic", label: "Critic", detail: `Average rating ${r.avg.toFixed(1)}` });
  if (r.genres >= 8) out.push({ key: "explorer", label: "Genre Explorer", detail: `Rated books in ${r.genres} genres` });
  if (r.lists >= 2) out.push({ key: "list-maker", label: "List Maker", detail: `${r.lists} public lists` });
  if (r.read >= 20) out.push({ key: "reader", label: "Bookworm", detail: `${r.read} books read` });
  if (r.joinRank < 50) out.push({ key: "early", label: "Early Member", detail: `One of the first 50 members` });
  return out;
}

export type ActivityEvent = {
  kind: "rated" | "want" | "reading" | "read" | "reviewed" | "list";
  ts: number;
  score: number | null;
  bookId: string | null;
  title: string;
  coverId: number | null;
  coverUrl: string | null;
  listId: number | null;
};

export async function getActivity(userId: number, limit = 20, includePrivate = true): Promise<ActivityEvent[]> {
  return db.all<ActivityEvent>(`SELECT * FROM (
      SELECT 'rated' AS kind, r.updated_at AS ts, r.score AS score, b.id AS bookId, b.title, b.cover_id AS coverId, b.cover_url AS coverUrl, NULL::int AS listId
        FROM ratings r JOIN books b ON b.id = r.book_id WHERE r.user_id = ?
      UNION ALL
      SELECT s.status, s.updated_at, NULL, b.id, b.title, b.cover_id, b.cover_url, NULL
        FROM shelf s JOIN books b ON b.id = s.book_id WHERE s.user_id = ?
      UNION ALL
      SELECT 'reviewed', rv.created_at, NULL, b.id, b.title, b.cover_id, b.cover_url, NULL
        FROM reviews rv JOIN books b ON b.id = rv.book_id WHERE rv.user_id = ?
      UNION ALL
      SELECT 'list', l.created_at, NULL, NULL, l.title, NULL, NULL, l.id
        FROM lists l WHERE l.user_id = ? ${includePrivate ? "" : "AND l.is_public = 1"}
    ) e ORDER BY ts DESC LIMIT ?`, userId, userId, userId, userId, limit);
}

/* ───────────── Title lists (IMDb list pages: Reading List, Your Ratings, user lists) ───────────── */

export type TitleSource = { kind: "shelf"; userId: number } | { kind: "ratings"; userId: number } | { kind: "list"; listId: number };
export type TitleSortKey = "order" | "title" | "rating" | "votes" | "popularity" | "year" | "pages" | "yours" | "rated";
export type TitleFilters = {
  genres?: string[]; statuses?: ShelfStatus[]; minRating?: number | null; yearFrom?: number | null; yearTo?: number | null; score?: number | null;
};
export type TitleItem = BookCard & {
  synopsis: string | null; yourRating: number | null; ratedAt: number | null; status: ShelfStatus | null; progress: number | null;
  addedAt: number | null; note: string | null; position: number | null;
};

/** Natural direction of each sort (the ↑↓ toggle flips it). "order" depends on the source. */
export const TITLE_SORT_DIR: Record<TitleSortKey, "asc" | "desc"> = {
  order: "desc", title: "asc", rating: "desc", votes: "desc", popularity: "asc", year: "desc", pages: "desc", yours: "desc", rated: "desc",
};

function titleBase(src: TitleSource) {
  if (src.kind === "shelf")
    return { from: `FROM shelf s JOIN books b ON b.id = s.book_id WHERE s.user_id = ?`, param: src.userId, order: "s.added_at",
      extra: `s.status AS status, s.progress AS progress, s.added_at AS addedAt, NULL::text AS note, NULL::int AS position` };
  if (src.kind === "ratings")
    return { from: `FROM ratings r0 JOIN books b ON b.id = r0.book_id WHERE r0.user_id = ?`, param: src.userId, order: "r0.updated_at",
      extra: `r0.created_at AS addedAt, NULL::text AS note, NULL::int AS position` };
  return { from: `FROM list_items li JOIN books b ON b.id = li.book_id WHERE li.list_id = ?`, param: src.listId, order: "li.position",
    extra: `NULL::bigint AS addedAt, li.note AS note, li.position AS position` };
}

/**
 * One query behind every IMDb-style list page. Filters and sort run in SQL; viewer columns (your rating,
 * shelf status) are for `viewerId`, which for the Reading List and Your Ratings is the owner.
 */
export async function getTitleItems(
  src: TitleSource, viewerId: number | null,
  opts: { filters?: TitleFilters; sort?: TitleSortKey; dir?: "asc" | "desc" } = {},
): Promise<{ items: TitleItem[]; total: number; genres: { slug: string; name: string; count: number }[] }> {
  const base = titleBase(src);
  const v = Math.trunc(viewerId ?? 0);
  const f = opts.filters ?? {};
  const where: string[] = [];
  const params: unknown[] = [base.param];
  const statusExpr = src.kind === "shelf" ? "s.status" : `(SELECT status FROM shelf x WHERE x.user_id = ${v} AND x.book_id = b.id)`;
  if (f.genres?.length) { where.push(`EXISTS (SELECT 1 FROM book_genres g WHERE g.book_id = b.id AND g.genre_slug IN (${f.genres.map(() => "?").join(",")}))`); params.push(...f.genres); }
  if (f.statuses?.length) { where.push(`${statusExpr} IN (${f.statuses.map(() => "?").join(",")})`); params.push(...f.statuses); }
  if (f.minRating) { where.push(`b.rating_avg >= ?`); params.push(f.minRating); }
  if (f.yearFrom) { where.push(`b.first_publish_year >= ?`); params.push(f.yearFrom); }
  if (f.yearTo) { where.push(`b.first_publish_year <= ?`); params.push(f.yearTo); }
  if (f.score) { where.push(`(SELECT score FROM ratings y WHERE y.user_id = ${v} AND y.book_id = b.id) = ?`); params.push(f.score); }

  const sort = opts.sort ?? "order";
  const natural = sort === "order" && src.kind === "list" ? "asc" : TITLE_SORT_DIR[sort];
  const dir = (opts.dir ?? natural).toUpperCase();
  const col: Record<TitleSortKey, string> = {
    order: base.order, title: "lower(b.title)", rating: "b.rating_avg", votes: "b.rating_count", popularity: "b.popularity_rank",
    year: "b.first_publish_year", pages: "b.pages", yours: "yourRating", rated: "ratedAt",
  };
  const viewerCols = `(SELECT score FROM ratings y WHERE y.user_id = ${v} AND y.book_id = b.id) AS yourRating,
    (SELECT updated_at FROM ratings y WHERE y.user_id = ${v} AND y.book_id = b.id) AS ratedAt`;
  const shelfCols = src.kind === "shelf" ? "" : `, ${statusExpr} AS status, (SELECT progress FROM shelf x WHERE x.user_id = ${v} AND x.book_id = b.id) AS progress`;
  const rows = await db.all<Parameters<typeof toCard>[0] & Omit<TitleItem, keyof BookCard>>(
    `SELECT ${CARD_COLUMNS}, b.synopsis AS synopsis, ${viewerCols}, ${base.extra}${shelfCols}
     ${base.from} ${where.length ? `AND ${where.join(" AND ")}` : ""}
     ORDER BY ${col[sort]} ${dir} NULLS LAST, lower(b.title) ASC`, ...params);
  const items = rows.map((r) => ({
    ...toCard(r), synopsis: r.synopsis, yourRating: r.yourRating, ratedAt: r.ratedAt, status: r.status ?? null, progress: r.progress ?? null,
    addedAt: r.addedAt, note: r.note, position: r.position,
  }));
  const total = (await db.get<{ n: number }>(`SELECT count(*) AS n ${base.from}`, base.param))!.n;
  const genres = await db.all<{ slug: string; name: string; count: number }>(
    `SELECT g.slug, g.name, count(*) AS count ${base.from.replace("WHERE", "JOIN book_genres bg ON bg.book_id = b.id JOIN genres g ON g.slug = bg.genre_slug WHERE")}
     GROUP BY g.slug, g.name, g.position ORDER BY count(*) DESC, g.position`, base.param);
  return { items, total, genres };
}

/** When the Reading List / ratings last changed ("Edited 2 days ago"). */
export async function getLastEdited(kind: "shelf" | "ratings", userId: number): Promise<number | null> {
  const t = kind === "shelf" ? "shelf" : "ratings";
  return (await db.get<{ t: number | null }>(`SELECT max(updated_at) AS t FROM ${t} WHERE user_id = ?`, userId))?.t ?? null;
}
