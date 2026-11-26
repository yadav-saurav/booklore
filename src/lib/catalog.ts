import "server-only";
import { sqlite, reindexBook } from "@/db";
import { getProvider } from "@/lib/providers/registry";
import type { ExternalAuthorRef, ExternalBook } from "@/lib/providers/types";
import { slugify } from "@/lib/util";

/**
 * Bridges external providers and the local catalog. External results are addressed as
 * "<source>:<externalId>" (e.g. "openlibrary:OL45883W"). Visiting one imports it into SQLite
 * so it can be rated, reviewed, listed and recommended like any seeded book.
 */
export const externalRef = (b: Pick<ExternalBook, "source" | "externalId">) => `${b.source}:${b.externalId}`;

function uniqueSlug(table: "books" | "authors", base: string): string {
  let slug = base;
  for (let i = 2; sqlite.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Map arbitrary provider subjects onto BOOKLORE's genre taxonomy. */
const GENRE_RULES: [string, RegExp][] = [
  ["science-fiction", /science fiction|sci-fi|dystopi|space|robots|time travel|cyberpunk/i],
  ["fantasy", /fantasy|magic|dragons|wizards|fairy/i],
  ["mystery", /mystery|detective|whodunit|crime fiction/i],
  ["thriller", /thriller|suspense|espionage|spy/i],
  ["horror", /horror|ghost|vampire|supernatural/i],
  ["romance", /romance|love stor/i],
  ["historical-fiction", /historical fiction/i],
  ["young-adult", /young adult|teen/i],
  ["childrens", /juvenile|children/i],
  ["graphic-novels", /comic|graphic novel|manga/i],
  ["poetry", /poetry|poems/i],
  ["biography-memoir", /biograph|memoir|autobiograph/i],
  ["history", /^history|history$|world war|civilization/i],
  ["science", /science|physics|biology|evolution|astronomy|mathematics/i],
  ["philosophy", /philosoph|ethics|stoic/i],
  ["psychology", /psychology|cognitive|behavior/i],
  ["self-help", /self-help|self-actualization|personal development|habits/i],
  ["business", /business|economics|management|leadership|finance/i],
  ["true-crime", /true crime|murder.*investigation/i],
  ["travel", /travel|voyages/i],
  ["humor", /humor|humour|satire|comedy/i],
  ["classics", /classic/i],
];

export function inferGenres(subjects: string[]): string[] {
  const out = new Set<string>();
  for (const [slug, re] of GENRE_RULES) if (subjects.some((s) => re.test(s))) out.add(slug);
  if (!out.size && subjects.some((s) => /fiction/i.test(s))) out.add("literary-fiction");
  return [...out].slice(0, 3);
}

function upsertAuthor(ref: ExternalAuthorRef, source: string): string {
  if (ref.externalId && source === "openlibrary") {
    const hit = sqlite.prepare(`SELECT id FROM authors WHERE ol_key = ?`).get(ref.externalId) as { id: string } | undefined;
    if (hit) return hit.id;
  }
  const byName = sqlite.prepare(`SELECT id FROM authors WHERE lower(name) = lower(?)`).get(ref.name) as { id: string } | undefined;
  if (byName) return byName.id;
  const id = uniqueSlug("authors", slugify(ref.name));
  sqlite
    .prepare(`INSERT INTO authors (id, ol_key, name, source) VALUES (?,?,?,?)`)
    .run(id, source === "openlibrary" ? ref.externalId ?? null : null, ref.name, source);
  return id;
}

export function findLocalByExternal(source: string, externalId: string): string | null {
  const col = source === "openlibrary" ? "ol_work_key" : source === "google" ? "google_id" : null;
  if (!col) return null;
  const r = sqlite.prepare(`SELECT id FROM books WHERE ${col} = ?`).get(externalId) as { id: string } | undefined;
  return r?.id ?? null;
}

export function importExternalBook(b: ExternalBook): string {
  const existing = findLocalByExternal(b.source, b.externalId);
  if (existing) return existing;
  const id = uniqueSlug("books", slugify(b.title));
  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO books (id, ol_work_key, google_id, title, subtitle, first_publish_year, cover_id, cover_url, isbn13, pages,
          publisher, language, synopsis, subjects, source, ol_rating_avg, ol_rating_count, ol_want_to_read)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id, b.source === "openlibrary" ? b.externalId : null, b.source === "google" ? b.externalId : null,
        b.title, b.subtitle ?? null, b.firstPublishYear ?? null, b.coverId ?? null, b.coverUrl ?? null, b.isbn13 ?? null,
        b.pages ?? null, b.publisher ?? null, b.language ?? null, b.description ?? null, JSON.stringify(b.subjects ?? []),
        b.source, b.ratingAvg ?? null, b.ratingCount ?? 0, b.wantToRead ?? 0,
      );
    b.authors.slice(0, 4).forEach((a, i) => {
      const authorId = upsertAuthor(a, b.source);
      sqlite.prepare(`INSERT OR IGNORE INTO book_authors (book_id, author_id, position) VALUES (?,?,?)`).run(id, authorId, i);
    });
    for (const g of inferGenres(b.subjects ?? []))
      sqlite.prepare(`INSERT OR IGNORE INTO book_genres (book_id, genre_slug) SELECT ?, slug FROM genres WHERE slug = ?`).run(id, g);
  });
  tx();
  reindexBook(id);
  return id;
}

/** Resolve "<source>:<id>" to a local slug, importing (full metadata fetch) when needed. */
export async function resolveExternalRef(ref: string): Promise<string | null> {
  const i = ref.indexOf(":");
  if (i < 0) return null;
  const source = ref.slice(0, i);
  const externalId = ref.slice(i + 1);
  const local = findLocalByExternal(source, externalId);
  if (local) return local;
  const provider = getProvider(source);
  if (!provider) return null;
  const full = await provider.getBook(externalId);
  return full ? importExternalBook(full) : null;
}

/** Fill in author details (dates, photo, bio) from Open Library the first time an author page is viewed. */
export async function hydrateAuthor(authorId: string) {
  const a = sqlite.prepare(`SELECT ol_key, bio, birth_date, photo_id FROM authors WHERE id = ?`).get(authorId) as
    | { ol_key: string | null; bio: string | null; birth_date: string | null; photo_id: number | null }
    | undefined;
  if (!a?.ol_key || (a.bio && a.photo_id)) return;
  const ol = getProvider("openlibrary");
  const ext = await ol?.getAuthor?.(a.ol_key);
  if (!ext) return;
  sqlite
    .prepare(`UPDATE authors SET bio = coalesce(bio, ?), birth_date = coalesce(birth_date, ?), death_date = coalesce(death_date, ?),
      photo_id = coalesce(photo_id, ?) WHERE id = ?`)
    .run(ext.bio?.slice(0, 1200) ?? null, ext.birthDate ?? null, ext.deathDate ?? null, ext.photoId ?? null, authorId);
}
