import "server-only";
import { db } from "@/db";
import { CARD_COLUMNS, getGenres, queryCards, type BookCard } from "@/lib/queries/books";

export type GenreRow = { slug: string; name: string; kanji: string | null; description: string };
export type GenreDetail = GenreRow & { count: number };

export type GenreTile = GenreRow & { count: number; covers: { id: string; title: string; coverId: number | null; coverUrl: string | null; authorName: string | null }[] };

export async function getGenre(slug: string): Promise<GenreDetail | null> {
  return (
    (await db.get<GenreDetail>(
      `SELECT g.slug, g.name, g.kanji, g.description,
         (SELECT count(*) FROM book_genres bg WHERE bg.genre_slug = g.slug) AS count
       FROM genres g WHERE g.slug = ?`,
      slug,
    )) ?? null
  );
}

/** All genres as index tiles, each with its book count and three of its most popular covers. */
export async function getGenreTiles(): Promise<GenreTile[]> {
  const genres = await getGenres();
  const covers = await db.all<GenreTile["covers"][number] & { slug: string }>(
    `SELECT genre_slug slug, id, title, coverId, coverUrl, authorName FROM (
                SELECT bg.genre_slug, b.id, b.title, b.cover_id coverId, b.cover_url coverUrl,
                  (SELECT string_agg(a.name, ', ' ORDER BY ba.position) FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id) AS authorName,
                  ROW_NUMBER() OVER (PARTITION BY bg.genre_slug ORDER BY b.popularity_score DESC, b.rating_count DESC) rn
                FROM book_genres bg JOIN books b ON b.id = bg.book_id) ranked
              WHERE rn <= 3`,
  );
  return genres.map((g) => ({ ...g, covers: covers.filter((c) => c.slug === g.slug) }));
}

export async function getTopRatedInGenre(slug: string, n = 12): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b JOIN book_genres bg ON bg.book_id = b.id AND bg.genre_slug = ?
     ORDER BY b.weighted_score IS NULL, b.weighted_score DESC, b.rating_count DESC LIMIT ?`,
    slug, n,
  );
}

export const GENRE_SORTS = {
  popularity: "b.popularity_score DESC",
  rating: "b.weighted_score IS NULL, b.weighted_score DESC",
  ratings: "b.rating_count DESC",
  newest: "b.first_publish_year IS NULL, b.first_publish_year DESC",
  oldest: "b.first_publish_year IS NULL, b.first_publish_year ASC",
  title: "lower(b.title) ASC",
} as const;
export type GenreSort = keyof typeof GENRE_SORTS;
export const isGenreSort = (v: unknown): v is GenreSort => typeof v === "string" && v in GENRE_SORTS;

export type GenreFilters = { sort: GenreSort; decade?: number; minRating?: number; page: number; pageSize: number };

export async function getGenreBooks(slug: string, f: GenreFilters): Promise<{ rows: BookCard[]; total: number }> {
  const decade = f.decade ?? null;
  const min = f.minRating ?? null;
  const from = `FROM books b JOIN book_genres bg ON bg.book_id = b.id
    WHERE bg.genre_slug = ?
      AND (?::int IS NULL OR (b.first_publish_year >= ?::int AND b.first_publish_year < ?::int + 10))
      AND (?::float8 IS NULL OR b.rating_avg >= ?::float8)`;
  const params = [slug, decade, decade, decade, min, min];
  const total = (await db.get<{ n: number }>(`SELECT count(*) n ${from}`, ...params))!.n;
  const rows = await queryCards(
    `SELECT ${CARD_COLUMNS} ${from} ORDER BY ${GENRE_SORTS[f.sort]}, lower(b.title) LIMIT ? OFFSET ?`,
    ...params, f.pageSize, (f.page - 1) * f.pageSize,
  );
  return { rows, total };
}

/** Decades that have at least one dated book in this genre, newest first. */
export async function getGenreDecades(slug: string): Promise<{ decade: number; count: number }[]> {
  return db.all(
    `SELECT (b.first_publish_year / 10) * 10 AS decade, count(*) AS count FROM books b JOIN book_genres bg ON bg.book_id = b.id
     WHERE bg.genre_slug = ? AND b.first_publish_year IS NOT NULL GROUP BY 1 ORDER BY 1 DESC`,
    slug,
  );
}

/** Genres that most often share a book with this one. */
export async function getRelatedGenres(slug: string, n = 8): Promise<(GenreRow & { shared: number })[]> {
  return db.all(
    `SELECT g.slug, g.name, g.kanji, g.description, count(*) AS shared
     FROM book_genres a JOIN book_genres b ON b.book_id = a.book_id AND b.genre_slug <> a.genre_slug
     JOIN genres g ON g.slug = b.genre_slug
     WHERE a.genre_slug = ? GROUP BY g.slug ORDER BY count(*) DESC, g.position LIMIT ?`,
    slug, n,
  );
}
