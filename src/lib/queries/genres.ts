import "server-only";
import { sqlite } from "@/db";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";

export type GenreRow = { slug: string; name: string; kanji: string | null; description: string };
export type GenreDetail = GenreRow & { count: number };

export type GenreTile = GenreRow & { count: number; covers: { id: string; title: string; coverId: number | null; coverUrl: string | null; authorName: string | null }[] };

export function getGenre(slug: string): GenreDetail | null {
  return (
    (sqlite
      .prepare(`SELECT g.slug, g.name, g.kanji, g.description,
                (SELECT count(*) FROM book_genres bg WHERE bg.genre_slug = g.slug) count
                FROM genres g WHERE g.slug = ?`)
      .get(slug) as GenreDetail | undefined) ?? null
  );
}

/** All genres as index tiles, each with its book count and three of its most popular covers. */
export function getGenreTiles(): GenreTile[] {
  const genres = sqlite
    .prepare(`SELECT g.slug, g.name, g.kanji, g.description, (SELECT count(*) FROM book_genres bg WHERE bg.genre_slug = g.slug) count
              FROM genres g ORDER BY g.position`)
    .all() as (GenreRow & { count: number })[];
  const covers = sqlite
    .prepare(`SELECT genre_slug slug, id, title, coverId, coverUrl, authorName FROM (
                SELECT bg.genre_slug, b.id, b.title, b.cover_id coverId, b.cover_url coverUrl,
                  (SELECT group_concat(a.name, ', ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id) authorName,
                  ROW_NUMBER() OVER (PARTITION BY bg.genre_slug ORDER BY b.popularity_score DESC, b.rating_count DESC) rn
                FROM book_genres bg JOIN books b ON b.id = bg.book_id)
              WHERE rn <= 3`)
    .all() as (GenreTile["covers"][number] & { slug: string })[];
  return genres.map((g) => ({ ...g, covers: covers.filter((c) => c.slug === g.slug) }));
}

export function getTopRatedInGenre(slug: string, n = 12): BookCard[] {
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
  title: "b.title COLLATE NOCASE ASC",
} as const;
export type GenreSort = keyof typeof GENRE_SORTS;
export const isGenreSort = (v: unknown): v is GenreSort => typeof v === "string" && v in GENRE_SORTS;

export type GenreFilters = { sort: GenreSort; decade?: number; minRating?: number; page: number; pageSize: number };

export function getGenreBooks(slug: string, f: GenreFilters): { rows: BookCard[]; total: number } {
  const where = [
    "bg.genre_slug = @slug",
    "(@decade IS NULL OR (b.first_publish_year >= @decade AND b.first_publish_year < @decade + 10))",
    "(@min IS NULL OR b.rating_avg >= @min)",
  ].join(" AND ");
  const params = { slug, decade: f.decade ?? null, min: f.minRating ?? null };
  const from = `FROM books b JOIN book_genres bg ON bg.book_id = b.id WHERE ${where}`;
  const total = (sqlite.prepare(`SELECT count(*) n ${from}`).get(params) as { n: number }).n;
  const named = sqlite
    .prepare(`SELECT ${CARD_COLUMNS} ${from} ORDER BY ${GENRE_SORTS[f.sort]}, b.title COLLATE NOCASE LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as (BookCard & { genreCsv: string | null })[];
  return { rows: named.map(({ genreCsv, ...r }) => ({ ...r, genres: genreCsv ? genreCsv.split(",") : [] })), total };
}

/** Decades that have at least one dated book in this genre, newest first. */
export function getGenreDecades(slug: string): { decade: number; count: number }[] {
  return sqlite
    .prepare(`SELECT (b.first_publish_year / 10) * 10 decade, count(*) count FROM books b JOIN book_genres bg ON bg.book_id = b.id
              WHERE bg.genre_slug = ? AND b.first_publish_year IS NOT NULL GROUP BY decade ORDER BY decade DESC`)
    .all(slug) as { decade: number; count: number }[];
}

/** Genres that most often share a book with this one. */
export function getRelatedGenres(slug: string, n = 8): (GenreRow & { shared: number })[] {
  return sqlite
    .prepare(`SELECT g.slug, g.name, g.kanji, g.description, count(*) shared
              FROM book_genres a JOIN book_genres b ON b.book_id = a.book_id AND b.genre_slug <> a.genre_slug
              JOIN genres g ON g.slug = b.genre_slug
              WHERE a.genre_slug = ? GROUP BY g.slug ORDER BY shared DESC, g.position LIMIT ?`)
    .all(slug, n) as (GenreRow & { shared: number })[];
}
