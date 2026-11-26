import "server-only";
import { sqlite } from "@/db";
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
export function getShelfBooks(n = 12): ShelfBook[] {
  const rows = sqlite
    .prepare(
      `SELECT b.id, b.title, b.first_publish_year year, b.cover_id coverId, b.cover_url coverUrl, b.synopsis, b.pages,
        b.rating_avg ratingAvg, b.rating_count ratingCount, b.weighted_score w,
        coalesce((SELECT group_concat(name, ', ') FROM (SELECT a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id
          WHERE ba.book_id = b.id ORDER BY ba.position)), 'Unknown') authorName,
        coalesce((SELECT g.name FROM book_genres bg JOIN genres g ON g.slug = bg.genre_slug WHERE bg.book_id = b.id ORDER BY g.position LIMIT 1), 'Fiction') genre,
        coalesce((SELECT g.kanji FROM book_genres bg JOIN genres g ON g.slug = bg.genre_slug WHERE bg.book_id = b.id ORDER BY g.position LIMIT 1), '本') genreKanji
       FROM books b
       WHERE b.cover_id IS NOT NULL AND b.synopsis IS NOT NULL AND b.first_publish_year IS NOT NULL AND b.weighted_score IS NOT NULL
       ORDER BY b.weighted_score DESC LIMIT 90`,
    )
    .all() as (ShelfBook & { w: number })[];
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

export function getFanFavorites(limit = 18): BookCard[] {
  return queryCards(`SELECT ${CARD_COLUMNS} FROM books b WHERE b.weighted_score IS NOT NULL ORDER BY b.weighted_score DESC LIMIT ?`, limit);
}

export function getTrending(limit = 10): BookCard[] {
  return queryCards(`SELECT ${CARD_COLUMNS} FROM books b WHERE b.popularity_rank IS NOT NULL ORDER BY b.popularity_rank LIMIT ?`, limit);
}

export function getNewAndNotable(limit = 18): BookCard[] {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE b.first_publish_year >= 2022 ORDER BY b.popularity_score DESC LIMIT ?`,
    limit,
  );
}

export function getReadingList(userId: number, limit = 18): BookCard[] {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM shelf s JOIN books b ON b.id = s.book_id WHERE s.user_id = ? AND s.status = 'want'
     ORDER BY s.added_at DESC LIMIT ?`,
    userId, limit,
  );
}

export type GenreTile = { slug: string; name: string; kanji: string | null; count: number; coverIds: number[] };
export function getGenreTiles(): GenreTile[] {
  const rows = sqlite
    .prepare(
      `SELECT g.slug, g.name, g.kanji, (SELECT count(*) FROM book_genres x WHERE x.genre_slug = g.slug) count,
        (SELECT group_concat(cover_id) FROM (SELECT b.cover_id FROM book_genres bg JOIN books b ON b.id = bg.book_id
          WHERE bg.genre_slug = g.slug AND b.cover_id IS NOT NULL ORDER BY b.popularity_score DESC LIMIT 3)) covers
       FROM genres g ORDER BY g.position`,
    )
    .all() as { slug: string; name: string; kanji: string | null; count: number; covers: string | null }[];
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

export function getBornToday(date = new Date()): { bornToday: boolean; authors: AuthorTile[] } {
  const all = sqlite
    .prepare(
      `SELECT a.id, a.name, a.photo_id photoId, a.birth_date birthDate, a.death_date deathDate,
        (SELECT b.title FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = a.id ORDER BY b.popularity_score DESC LIMIT 1) knownFor
       FROM authors a ORDER BY a.popularity DESC`,
    )
    .all() as AuthorTile[];
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

export function getFeaturedLists(limit = 6): FeaturedList[] {
  const lists = sqlite
    .prepare(
      `SELECT l.id, l.title, l.description, u.username owner, u.display_name ownerName, l.like_count likes,
        (SELECT count(*) FROM list_items li WHERE li.list_id = l.id) count
       FROM lists l JOIN users u ON u.id = l.user_id WHERE l.is_public = 1
       ORDER BY l.is_featured DESC, l.like_count DESC LIMIT ?`,
    )
    .all(limit) as Omit<FeaturedList, "covers">[];
  const coverQ = sqlite.prepare(
    `SELECT b.id, b.title, b.cover_id coverId, b.cover_url coverUrl FROM list_items li JOIN books b ON b.id = li.book_id
     WHERE li.list_id = ? ORDER BY li.position LIMIT 3`,
  );
  return lists.map((l) => ({ ...l, covers: coverQ.all(l.id) as FeaturedList["covers"] }));
}

export type LatestReview = {
  id: number; headline: string; body: string; spoiler: boolean; createdAt: number; helpful: number;
  username: string; displayName: string; avatarHue: number; score: number | null;
  bookId: string; bookTitle: string; coverId: number | null; coverUrl: string | null; year: number | null;
};

export function getLatestReviews(limit = 3): LatestReview[] {
  return (
    sqlite
      .prepare(
        `SELECT r.id, r.headline, r.body, r.spoiler, r.created_at createdAt, r.helpful_count helpful,
          u.username, u.display_name displayName, u.avatar_hue avatarHue,
          (SELECT score FROM ratings x WHERE x.user_id = r.user_id AND x.book_id = r.book_id) score,
          b.id bookId, b.title bookTitle, b.cover_id coverId, b.cover_url coverUrl, b.first_publish_year year
         FROM reviews r JOIN users u ON u.id = r.user_id JOIN books b ON b.id = r.book_id
         WHERE r.spoiler = 0 AND length(r.body) > 120
         ORDER BY r.created_at DESC LIMIT ?`,
      )
      .all(limit) as (Omit<LatestReview, "spoiler"> & { spoiler: number })[]
  ).map((r) => ({ ...r, spoiler: !!r.spoiler }));
}

export function getTopPreview(limit = 10): BookCard[] {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE b.rating_count >= 25 ORDER BY b.weighted_score DESC LIMIT ?`,
    limit,
  );
}

export function getUserShelfStatus(userId: number | null | undefined, ids: string[]): Record<string, string> {
  if (!userId || !ids.length) return {};
  const rows = sqlite
    .prepare(`SELECT book_id, status FROM shelf WHERE user_id = ? AND book_id IN (${ids.map(() => "?").join(",")})`)
    .all(userId, ...ids) as { book_id: string; status: string }[];
  return Object.fromEntries(rows.map((r) => [r.book_id, r.status]));
}
