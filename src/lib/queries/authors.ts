import "server-only";
import { db } from "@/db";
import { isBornOn } from "@/components/author/birthdate";
import { CARD_COLUMNS, queryCards, type BookCard } from "@/lib/queries/books";

export type AuthorRow = {
  id: string; olKey: string | null; name: string; birthDate: string | null; deathDate: string | null;
  photoId: number | null; photoUrl: string | null; bio: string | null; nationality: string | null; popularity: number;
};

export type AuthorStats = { books: number; avgRating: number | null; totalRatings: number; rank: number | null };

export const BIB_SORTS = {
  year: { sql: "b.first_publish_year IS NULL, b.first_publish_year", defaultDir: "desc" },
  rating: { sql: "b.rating_avg IS NULL, b.rating_avg", defaultDir: "desc" },
  popularity: { sql: "b.popularity_score", defaultDir: "desc" },
  title: { sql: "lower(b.title)", defaultDir: "asc" },
} as const;
export type BibSort = keyof typeof BIB_SORTS;
export const isBibSort = (v: unknown): v is BibSort => typeof v === "string" && v in BIB_SORTS;

export async function getAuthor(id: string): Promise<AuthorRow | null> {
  return (
    (await db.get<AuthorRow>(
      `SELECT id, ol_key olKey, name, birth_date birthDate, death_date deathDate, photo_id photoId, photo_url photoUrl,
         bio, nationality, popularity FROM authors WHERE id = ?`,
      id,
    )) ?? null
  );
}

export async function getAuthorStats(id: string): Promise<AuthorStats> {
  const s = (await db.get<{ books: number; avgRating: number | null; totalRatings: number }>(
    `SELECT count(*) books,
        CASE WHEN coalesce(sum(b.rating_count), 0) > 0 THEN sum(b.rating_avg * b.rating_count) / sum(b.rating_count) END avgRating,
        coalesce(sum(b.rating_count), 0) totalRatings
      FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = ?`,
    id,
  ))!;
  const pop = await db.get<{ popularity: number }>(`SELECT popularity FROM authors WHERE id = ?`, id);
  const rank = pop && pop.popularity > 0
    ? (await db.get<{ r: number }>(`SELECT count(*) + 1 r FROM authors WHERE popularity > ?`, pop.popularity))!.r
    : null;
  return { ...s, rank };
}

/** Top books by popularity for "Known for". */
export async function getKnownFor(authorId: string, n = 4): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b JOIN book_authors ba ON ba.book_id = b.id AND ba.author_id = ?
     ORDER BY b.popularity_score DESC, b.rating_count DESC LIMIT ?`,
    authorId, n,
  );
}

export async function getBibliography(authorId: string, sort: BibSort, dir: "asc" | "desc", genre?: string): Promise<BookCard[]> {
  const order = `${BIB_SORTS[sort].sql} ${dir === "asc" ? "ASC" : "DESC"}, lower(b.title)`;
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b JOIN book_authors ba ON ba.book_id = b.id AND ba.author_id = ?
     WHERE (?::text IS NULL OR EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_slug = ?))
     ORDER BY ${order}`,
    authorId, genre ?? null, genre ?? null,
  );
}

export async function getAuthorGenres(authorId: string): Promise<{ slug: string; name: string }[]> {
  return db.all(
    `SELECT DISTINCT g.slug, g.name, g.position FROM book_authors ba
     JOIN book_genres bg ON bg.book_id = ba.book_id JOIN genres g ON g.slug = bg.genre_slug
     WHERE ba.author_id = ? ORDER BY g.position`,
    authorId,
  );
}

export type ReaderAuthor = { id: string; name: string; photoId: number | null; photoUrl: string | null; fans: number };

/**
 * "Readers also like": authors whose books were rated 8+ by the same people who rated this
 * author's books 8+. Co-occurrence over the ratings table.
 */
export async function getReadersAlsoLike(authorId: string, n = 6): Promise<ReaderAuthor[]> {
  return db.all<ReaderAuthor>(
      `WITH fans AS (
         SELECT DISTINCT r.user_id FROM ratings r JOIN book_authors ba ON ba.book_id = r.book_id
         WHERE ba.author_id = ? AND r.score >= 8
       )
       SELECT a.id, a.name, a.photo_id photoId, a.photo_url photoUrl, count(DISTINCT r.user_id) fans
       FROM fans f
       JOIN ratings r ON r.user_id = f.user_id AND r.score >= 8
       JOIN book_authors ba ON ba.book_id = r.book_id
       JOIN authors a ON a.id = ba.author_id
       WHERE ba.author_id <> ?
       GROUP BY a.id
       ORDER BY fans DESC, a.popularity DESC, a.name
       LIMIT ?`,
      authorId, authorId, n,
  );
}

/** Which Open Library work keys already exist in the catalog. */
export async function existingOlWorkKeys(keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const ph = keys.map(() => "?").join(",");
  const rows = await db.all<{ k: string }>(`SELECT ol_work_key k FROM books WHERE ol_work_key IN (${ph})`, ...keys);
  return new Set(rows.map((r) => r.k));
}

export async function authorBookTitles(authorId: string): Promise<string[]> {
  return (await db.all<{ title: string }>(
    `SELECT b.title FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = ?`, authorId,
  )).map((r) => r.title);
}

export type AuthorListItem = {
  id: string; name: string; photoId: number | null; photoUrl: string | null; nationality: string | null;
  popularity: number; birthDate: string | null; bookCount: number; knownFor: string | null;
};

const LIST_SELECT = `SELECT a.id, a.name, a.photo_id photoId, a.photo_url photoUrl, a.nationality, a.popularity,
    a.birth_date birthDate,
    (SELECT count(*) FROM book_authors x WHERE x.author_id = a.id) bookCount,
    (SELECT b.title FROM book_authors ba JOIN books b ON b.id = ba.book_id WHERE ba.author_id = a.id
       ORDER BY b.popularity_score DESC LIMIT 1) knownFor
  FROM authors a
  WHERE EXISTS (SELECT 1 FROM book_authors x WHERE x.author_id = a.id)
    AND (?::text IS NULL OR a.nationality = ?)`;

export async function listAuthors(opts: { nat?: string; page: number; pageSize: number }): Promise<{ rows: AuthorListItem[]; total: number }> {
  const nat = opts.nat ?? null;
  const total = (await db.get<{ n: number }>(
    `SELECT count(*) n FROM authors a WHERE EXISTS (SELECT 1 FROM book_authors x WHERE x.author_id = a.id)
     AND (?::text IS NULL OR a.nationality = ?)`,
    nat, nat,
  ))!.n;
  const rows = await db.all<AuthorListItem>(
    `${LIST_SELECT} ORDER BY a.popularity DESC, bookCount DESC, a.name LIMIT ? OFFSET ?`,
    nat, nat, opts.pageSize, (opts.page - 1) * opts.pageSize,
  );
  return { rows, total };
}

/** Authors whose free-text birth date falls on the given calendar day, most popular first. */
export async function listBornOn(month: number, day: number, nat?: string): Promise<AuthorListItem[]> {
  const rows = await db.all<AuthorListItem>(
    `${LIST_SELECT} AND a.birth_date IS NOT NULL ORDER BY a.popularity DESC, bookCount DESC, a.name`,
    nat ?? null, nat ?? null,
  );
  return rows.filter((r) => isBornOn(r.birthDate, month, day));
}

export async function getNationalities(limit = 12): Promise<{ name: string; count: number }[]> {
  return db.all(
    `SELECT nationality AS name, count(*) AS count FROM authors
     WHERE nationality IS NOT NULL AND trim(nationality) <> '' GROUP BY nationality ORDER BY count(*) DESC, nationality LIMIT ?`,
    limit,
  );
}
