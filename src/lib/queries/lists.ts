import "server-only";
import { db } from "@/db";
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
async function withCovers(rows: Omit<ListSummary, "covers">[]): Promise<ListSummary[]> {
  if (!rows.length) return [];
  const ph = rows.map(() => "?").join(",");
  const tiles = await db.all<CoverTile & { listId: number }>(`SELECT li.list_id AS listId, b.id, b.title, b.cover_id AS coverId, b.cover_url AS coverUrl
      FROM list_items li JOIN books b ON b.id = li.book_id
      WHERE li.list_id IN (${ph}) ORDER BY li.list_id, li.position`, ...rows.map((r) => r.id));
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

export async function getFeaturedLists(limit = 6): Promise<ListSummary[]> {
  return withCovers(await db.all(`${SUMMARY_SQL} WHERE l.is_public = 1 AND l.is_featured = 1 ORDER BY l.updated_at DESC LIMIT ?`, limit));
}

export async function getPopularLists(limit = 8): Promise<ListSummary[]> {
  return withCovers(await db.all(`${SUMMARY_SQL} WHERE l.is_public = 1 ORDER BY l.like_count DESC, l.updated_at DESC LIMIT ?`, limit));
}

export async function getRecentLists(limit = 12, offset = 0): Promise<ListSummary[]> {
  return withCovers(await db.all(`${SUMMARY_SQL} WHERE l.is_public = 1 ORDER BY l.updated_at DESC, l.id DESC LIMIT ? OFFSET ?`, limit, offset));
}

export async function countPublicLists(): Promise<number> {
  return (await db.get<{ n: number }>(`SELECT count(*) AS n FROM lists WHERE is_public = 1`))!.n;
}

/** A member's lists. Pass includePrivate for the owner's own view. */
export async function getUserLists(ownerId: number, includePrivate: boolean): Promise<ListSummary[]> {
  return withCovers(
    await db.all(`${SUMMARY_SQL} WHERE l.user_id = ? ${includePrivate ? "" : "AND l.is_public = 1"} ORDER BY l.updated_at DESC`, ownerId),
  );
}

export type ListDetail = ListSummary & { ownerId: number };

export async function getListDetail(id: number): Promise<ListDetail | null> {
  const row = await db.get<Omit<ListSummary, "covers">>(`${SUMMARY_SQL} WHERE l.id = ?`, id);
  if (!row) return null;
  return (await withCovers([row]))[0];
}

export type ListItemRow = BookCard & { position: number; note: string | null; yourRating: number | null };

export async function getListItems(listId: number, viewerId: number | null): Promise<ListItemRow[]> {
  const rows = await db.all<Parameters<typeof toCard>[0] & { position: number; note: string | null; yourRating: number | null }>(`SELECT ${CARD_COLUMNS}, li.position AS position, li.note AS note,
        (SELECT score FROM ratings r WHERE r.user_id = ? AND r.book_id = b.id) AS yourRating
      FROM list_items li JOIN books b ON b.id = li.book_id
      WHERE li.list_id = ? ORDER BY li.position`, viewerId, listId);
  return rows.map((r) => ({ ...toCard(r), position: r.position, note: r.note, yourRating: r.yourRating }));
}

export async function getListLikeState(listId: number, userId: number | null): Promise<{ liked: boolean; likeCount: number }> {
  const liked = userId ? !!(await db.get(`SELECT 1 FROM list_likes WHERE list_id = ? AND user_id = ?`, listId, userId)) : false;
  const likeCount = (await db.get<{ n: number }>(`SELECT like_count AS n FROM lists WHERE id = ?`, listId))?.n ?? 0;
  return { liked, likeCount };
}

/** The signed-in user's lists, with whether each already contains the given book (for AddToListButton). */
export type MyListRow = { id: number; title: string; isPublic: boolean; included: boolean };

export async function getMyListsWithBook(userId: number, bookId: string): Promise<MyListRow[]> {
  return (await db.all<{ id: number; title: string; isPublic: number; included: boolean }>(`SELECT l.id, l.title, l.is_public AS isPublic,
        EXISTS (SELECT 1 FROM list_items li WHERE li.list_id = l.id AND li.book_id = ?) AS included
      FROM lists l WHERE l.user_id = ? ORDER BY l.updated_at DESC`, bookId, userId))
    .map((r) => ({ id: r.id, title: r.title, isPublic: !!r.isPublic, included: !!r.included }));
}
