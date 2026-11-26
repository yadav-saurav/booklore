import "server-only";
import { sqlite } from "@/db";
import { CARD_COLUMNS, toCard, type BookCard } from "@/lib/queries/books";

export type CoverTile = { id: string; title: string; coverId: number | null; coverUrl: string | null };

export type ListSummary = {
  id: number;
  title: string;
  description: string;
  isPublic: boolean;
  isFeatured: boolean;
  likeCount: number;
  itemCount: number;
  updatedAt: number;
  ownerId: number;
  ownerUsername: string;
  ownerName: string;
  ownerHue: number;
  covers: CoverTile[];
};

const SUMMARY_SQL = `SELECT l.id, l.title, l.description, l.is_public AS isPublic, l.is_featured AS isFeatured,
    l.like_count AS likeCount, l.updated_at AS updatedAt,
    u.id AS ownerId, u.username AS ownerUsername, u.display_name AS ownerName, u.avatar_hue AS ownerHue,
    (SELECT count(*) FROM list_items li WHERE li.list_id = l.id) AS itemCount
  FROM lists l JOIN users u ON u.id = l.user_id`;

/** Attach the first four cover tiles (by position) to a set of list rows, in one query. */
function withCovers(rows: Omit<ListSummary, "covers">[]): ListSummary[] {
  if (!rows.length) return [];
  const ph = rows.map(() => "?").join(",");
  const tiles = sqlite
    .prepare(`SELECT li.list_id AS listId, b.id, b.title, b.cover_id AS coverId, b.cover_url AS coverUrl
      FROM list_items li JOIN books b ON b.id = li.book_id
      WHERE li.list_id IN (${ph}) ORDER BY li.list_id, li.position`)
    .all(...rows.map((r) => r.id)) as (CoverTile & { listId: number })[];
  const byList = new Map<number, CoverTile[]>();
  for (const t of tiles) {
    const arr = byList.get(t.listId) ?? [];
    if (arr.length < 4) arr.push({ id: t.id, title: t.title, coverId: t.coverId, coverUrl: t.coverUrl });
    byList.set(t.listId, arr);
  }
  return rows.map((r) => ({
    ...r,
    isPublic: !!r.isPublic,
    isFeatured: !!r.isFeatured,
    covers: byList.get(r.id) ?? [],
  }));
}

export function getFeaturedLists(limit = 6): ListSummary[] {
  return withCovers(sqlite.prepare(`${SUMMARY_SQL} WHERE l.is_public = 1 AND l.is_featured = 1 ORDER BY l.updated_at DESC LIMIT ?`).all(limit) as never);
}

export function getPopularLists(limit = 8): ListSummary[] {
  return withCovers(sqlite.prepare(`${SUMMARY_SQL} WHERE l.is_public = 1 ORDER BY l.like_count DESC, l.updated_at DESC LIMIT ?`).all(limit) as never);
}

export function getRecentLists(limit = 12, offset = 0): ListSummary[] {
  return withCovers(sqlite.prepare(`${SUMMARY_SQL} WHERE l.is_public = 1 ORDER BY l.updated_at DESC LIMIT ? OFFSET ?`).all(limit, offset) as never);
}

export function countPublicLists(): number {
  return (sqlite.prepare(`SELECT count(*) n FROM lists WHERE is_public = 1`).get() as { n: number }).n;
}

/** A member's lists. Pass includePrivate for the owner's own view. */
export function getUserLists(ownerId: number, includePrivate: boolean): ListSummary[] {
  return withCovers(
    sqlite.prepare(`${SUMMARY_SQL} WHERE l.user_id = ? ${includePrivate ? "" : "AND l.is_public = 1"} ORDER BY l.updated_at DESC`).all(ownerId) as never,
  );
}

export type ListDetail = ListSummary & { ownerId: number };

export function getListDetail(id: number): ListDetail | null {
  const row = sqlite.prepare(`${SUMMARY_SQL} WHERE l.id = ?`).get(id) as Omit<ListSummary, "covers"> | undefined;
  if (!row) return null;
  return withCovers([row])[0];
}

export type ListItemRow = BookCard & { position: number; note: string | null; yourRating: number | null };

export function getListItems(listId: number, viewerId: number | null): ListItemRow[] {
  const rows = sqlite
    .prepare(`SELECT ${CARD_COLUMNS}, li.position AS position, li.note AS note,
        (SELECT score FROM ratings r WHERE r.user_id = ? AND r.book_id = b.id) AS yourRating
      FROM list_items li JOIN books b ON b.id = li.book_id
      WHERE li.list_id = ? ORDER BY li.position`)
    .all(viewerId, listId) as (Parameters<typeof toCard>[0] & { position: number; note: string | null; yourRating: number | null })[];
  return rows.map((r) => ({ ...toCard(r), position: r.position, note: r.note, yourRating: r.yourRating }));
}

export function getListLikeState(listId: number, userId: number | null): { liked: boolean; likeCount: number } {
  const liked = userId ? !!sqlite.prepare(`SELECT 1 FROM list_likes WHERE list_id = ? AND user_id = ?`).get(listId, userId) : false;
  const likeCount = (sqlite.prepare(`SELECT like_count n FROM lists WHERE id = ?`).get(listId) as { n: number } | undefined)?.n ?? 0;
  return { liked, likeCount };
}

/** The signed-in user's lists, with whether each already contains the given book (for AddToListButton). */
export function getMyListsWithBook(userId: number, bookId: string) {
  return (sqlite
    .prepare(`SELECT l.id, l.title, l.is_public AS isPublic,
        EXISTS (SELECT 1 FROM list_items li WHERE li.list_id = l.id AND li.book_id = ?) AS included
      FROM lists l WHERE l.user_id = ? ORDER BY l.updated_at DESC`)
    .all(bookId, userId) as { id: number; title: string; isPublic: number; included: number }[])
    .map((r) => ({ id: r.id, title: r.title, isPublic: !!r.isPublic, included: !!r.included }));
}
