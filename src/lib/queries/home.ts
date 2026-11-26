import "server-only";
import { db } from "@/db";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";

export type ShelfBook = {
  id: string;
  title: string;
  year: number;
  coverId: number | null;
  coverUrl: string | null;
  authorName: string;
  synopsis: string;
  pages: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  genre: string;
  genreKanji: string;
};

/**
 * ~12 featured books for the shelf hero: highly rated seed books with covers, spread across eras.
 * Candidates are the top weighted books; sorted by year, split into 12 buckets, best of each bucket wins.
 */
export async function getShelfBooks(n = 12): Promise<ShelfBook[]> {
  const rows = await db.all<ShelfBook & { w: number }>(
      `SELECT b.id, b.title, b.first_publish_year AS year, b.cover_id AS coverId, b.cover_url AS coverUrl, b.synopsis, b.pages,
        b.rating_avg AS ratingAvg, b.rating_count AS ratingCount, b.weighted_score AS w,
        coalesce((SELECT string_agg(a.name, ', ' ORDER BY ba.position) FROM book_authors ba JOIN authors a ON a.id = ba.author_id
          WHERE ba.book_id = b.id), 'Unknown') AS authorName,
        coalesce((SELECT g.name FROM book_genres bg JOIN genres g ON g.slug = bg.genre_slug WHERE bg.book_id = b.id ORDER BY g.position LIMIT 1), 'Fiction') AS genre,
        coalesce((SELECT g.kanji FROM book_genres bg JOIN genres g ON g.slug = bg.genre_slug WHERE bg.book_id = b.id ORDER BY g.position LIMIT 1), '本') AS genreKanji
       FROM books b
       WHERE b.cover_id IS NOT NULL AND b.synopsis IS NOT NULL AND b.first_publish_year IS NOT NULL AND b.weighted_score IS NOT NULL
       ORDER BY b.weighted_score DESC LIMIT 90`,
  );
  if (rows.length <= n) return rows.sort((a, b) => a.year - b.year);
  const byYear = [...rows].sort((a, b) => a.year - b.year);
  const out: ShelfBook[] = [];
  for (let i = 0; i < n; i++) {
    const bucket = byYear.slice(Math.floor((i * byYear.length) / n), Math.floor(((i + 1) * byYear.length) / n));
    const best = bucket.reduce((m, r) => (r.w > m.w ? r : m), bucket[0]);
    const { w, ...rest } = best;
    void w;
    out.push(rest);
  }
  return out;
}

export async function getFanFavorites(limit = 18): Promise<BookCard[]> {
  return queryCards(`SELECT ${CARD_COLUMNS} FROM books b WHERE b.weighted_score IS NOT NULL ORDER BY b.weighted_score DESC LIMIT ?`, limit);
}

export async function getTrending(limit = 10): Promise<BookCard[]> {
  return queryCards(`SELECT ${CARD_COLUMNS} FROM books b WHERE b.popularity_rank IS NOT NULL ORDER BY b.popularity_rank LIMIT ?`, limit);
}

export async function getNewAndNotable(limit = 18): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE b.first_publish_year >= 2022 ORDER BY b.popularity_score DESC NULLS LAST LIMIT ?`,
    limit,
  );
}

export async function getReadingList(userId: number, limit = 18): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM shelf s JOIN books b ON b.id = s.book_id WHERE s.user_id = ? AND s.status = 'want'
     ORDER BY s.added_at DESC LIMIT ?`,
    userId, limit,
  );
}

export type GenreTile = { slug: string; name: string; kanji: string | null; count: number; coverIds: number[] };
export async function getGenreTiles(): Promise<GenreTile[]> {
  const rows = await db.all<{ slug: string; name: string; kanji: string | null; count: number; covers: string | null }>(
      `SELECT g.slug, g.name, g.kanji, (SELECT count(*) FROM book_genres x WHERE x.genre_slug = g.slug) AS count,
        (SELECT string_agg(t.cover_id::text, ',') FROM (SELECT b.cover_id FROM book_genres bg JOIN books b ON b.id = bg.book_id
          WHERE bg.genre_slug = g.slug AND b.cover_id IS NOT NULL ORDER BY b.popularity_score DESC NULLS LAST LIMIT 3) t) AS covers
       FROM genres g ORDER BY g.position`,
  );
  return rows.map(({ covers, ...r }) => ({ ...r, coverIds: covers ? covers.split(",").map(Number) : [] }));
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Parse Open Library's free-text birth dates ("22 August 1920", "August 22, 1920", "1920-08-22") → [month, day]. */
export function parseMonthDay(s: string | null): [number, number] | null {
  if (!s) return null;
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return [Number(iso[2]), Number(iso[3])];
  const lower = s.toLowerCase();
  const mi = MONTHS.findIndex((m) => lower.includes(m) || new RegExp(`\\b${m.slice(0, 3)}\\.?\\b`).test(lower));
  if (mi < 0) return null;
  const day = lower.replace(/\d{4}/g, "").match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  return day ? [mi + 1, Number(day[1])] : null;
}

export type AuthorTile = { id: string; name: string; photoId: number | null; birthDate: string | null; deathDate: string | null; knownFor: string | null };

export async function getBornToday(date = new Date()): Promise<{ bornToday: boolean; authors: AuthorTile[] }> {
  const all = await db.all<AuthorTile>(
      `SELECT a.id, a.name, a.photo_id AS photoId, a.birth_date AS birthDate, a.death_date AS deathDate,
        (SELECT b.title FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = a.id ORDER BY b.popularity_score DESC NULLS LAST LIMIT 1) AS knownFor
       FROM authors a ORDER BY a.popularity DESC NULLS LAST`,
  );
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const today = all.filter((a) => {
    const md = parseMonthDay(a.birthDate);
    return md && md[0] === m && md[1] === d;
  });
  if (today.length) return { bornToday: true, authors: today.slice(0, 12) };
  return { bornToday: false, authors: all.slice(0, 12) };
}

export type FeaturedList = { id: number; title: string; description: string; owner: string; ownerName: string; count: number; likes: number; covers: { id: string; title: string; coverId: number | null; coverUrl: string | null }[] };

export async function getFeaturedLists(limit = 6): Promise<FeaturedList[]> {
  const lists = await db.all<Omit<FeaturedList, "covers">>(
      `SELECT l.id, l.title, l.description, u.username AS owner, u.display_name AS ownerName, l.like_count AS likes,
        (SELECT count(*) FROM list_items li WHERE li.list_id = l.id) AS count
       FROM lists l JOIN users u ON u.id = l.user_id WHERE l.is_public = 1
       ORDER BY l.is_featured DESC, l.like_count DESC LIMIT ?`,
    limit,
  );
  return Promise.all(
    lists.map(async (l) => ({
      ...l,
      covers: await db.all<FeaturedList["covers"][number]>(
        `SELECT b.id, b.title, b.cover_id AS coverId, b.cover_url AS coverUrl FROM list_items li JOIN books b ON b.id = li.book_id
         WHERE li.list_id = ? ORDER BY li.position LIMIT 3`,
        l.id,
      ),
    })),
  );
}

export type LatestReview = {
  id: number; headline: string; body: string; spoiler: boolean; createdAt: number; helpful: number;
  username: string; displayName: string; avatarHue: number; score: number | null;
  bookId: string; bookTitle: string; coverId: number | null; coverUrl: string | null; year: number | null;
};

export async function getLatestReviews(limit = 3): Promise<LatestReview[]> {
  return (
    await db.all<Omit<LatestReview, "spoiler"> & { spoiler: number }>(
        `SELECT r.id, r.headline, r.body, r.spoiler, r.created_at AS createdAt, r.helpful_count AS helpful,
          u.username, u.display_name AS displayName, u.avatar_hue AS avatarHue,
          (SELECT score FROM ratings x WHERE x.user_id = r.user_id AND x.book_id = r.book_id) AS score,
          b.id AS bookId, b.title AS bookTitle, b.cover_id AS coverId, b.cover_url AS coverUrl, b.first_publish_year AS year
         FROM reviews r JOIN users u ON u.id = r.user_id JOIN books b ON b.id = r.book_id
         WHERE r.spoiler = 0 AND length(r.body) > 120
         ORDER BY r.created_at DESC LIMIT ?`,
        limit,
    )
  ).map((r) => ({ ...r, spoiler: !!r.spoiler }));
}

export async function getTopPreview(limit = 10): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE b.rating_count >= 25 ORDER BY b.weighted_score DESC NULLS LAST LIMIT ?`,
    limit,
  );
}

export async function getUserShelfStatus(userId: number | null | undefined, ids: string[]): Promise<Record<string, string>> {
  if (!userId || !ids.length) return {};
  const rows = await db.all<{ book_id: string; status: string }>(
    `SELECT book_id, status FROM shelf WHERE user_id = ? AND book_id IN (${ids.map(() => "?").join(",")})`,
    userId, ...ids,
  );
  return Object.fromEntries(rows.map((r) => [r.book_id, r.status]));
}
