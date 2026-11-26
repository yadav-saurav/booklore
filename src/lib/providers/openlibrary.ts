import type { BookProvider, ExternalAuthor, ExternalBook, SearchOptions } from "./types";
import { cachedJson } from "./http";

const BASE = "https://openlibrary.org";
const FIELDS =
  "key,title,subtitle,author_name,author_key,first_publish_year,cover_i,number_of_pages_median,isbn,publisher,language,subject,ratings_average,ratings_count,want_to_read_count";

type OLDoc = {
  key: string; title: string; subtitle?: string; author_name?: string[]; author_key?: string[];
  first_publish_year?: number; cover_i?: number; number_of_pages_median?: number; isbn?: string[];
  publisher?: string[]; language?: string[]; subject?: string[]; ratings_average?: number;
  ratings_count?: number; want_to_read_count?: number;
};

const textOf = (v: unknown): string | null =>
  typeof v === "string" ? v : v && typeof v === "object" && "value" in v ? String((v as { value: unknown }).value) : null;
const stripKey = (k: string) => k.split("/").pop()!;
const isbn13 = (list?: string[]) => list?.find((i) => /^97[89]\d{10}$/.test(i)) ?? null;
const lang2: Record<string, string> = { eng: "en", fre: "fr", ger: "de", spa: "es", ita: "it", jpn: "ja", rus: "ru", por: "pt" };

export function cleanSubjects(list: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const s = raw.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
    if (!s || s.length > 40 || /[:=]|nyt:|accessible|protected daisy|lending library|in library|large type|reading level|open library/i.test(s)) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s[0].toUpperCase() + s.slice(1));
    if (out.length >= 12) break;
  }
  return out;
}

function fromDoc(d: OLDoc): ExternalBook {
  return {
    source: "openlibrary",
    externalId: stripKey(d.key),
    title: d.title,
    subtitle: d.subtitle ?? null,
    authors: (d.author_name ?? []).map((name, i) => ({ name, externalId: d.author_key?.[i] })),
    firstPublishYear: d.first_publish_year ?? null,
    coverId: d.cover_i ?? null,
    isbn13: isbn13(d.isbn),
    pages: d.number_of_pages_median ?? null,
    publisher: d.publisher?.[0] ?? null,
    language: d.language?.[0] ? lang2[d.language[0]] ?? d.language[0] : null,
    subjects: cleanSubjects(d.subject),
    ratingAvg: d.ratings_average ? Math.round(d.ratings_average * 2 * 10) / 10 : null, // 5-star → 10-point
    ratingCount: d.ratings_count ?? null,
    wantToRead: d.want_to_read_count ?? null,
  };
}

export const openLibrary: BookProvider = {
  id: "openlibrary",
  name: "Open Library",
  attribution: { label: "Open Library", url: "https://openlibrary.org" },
  enabled: () => process.env.BOOKLORE_DISABLE_OPENLIBRARY !== "1",

  async searchBooks(query: string, opts: SearchOptions = {}) {
    const p = new URLSearchParams({ fields: FIELDS, limit: String(opts.limit ?? 20), page: String(opts.page ?? 1) });
    if (query) p.set("q", query);
    if (opts.title) p.set("title", opts.title);
    if (opts.author) p.set("author", opts.author);
    if (opts.subject) p.set("subject", opts.subject);
    if (opts.isbn) p.set("isbn", opts.isbn);
    if (opts.sort === "new") p.set("sort", "new");
    if (opts.sort === "old") p.set("sort", "old");
    if (opts.sort === "rating") p.set("sort", "rating");
    const data = await cachedJson<{ docs: OLDoc[] }>(`${BASE}/search.json?${p}`, 60 * 60 * 6);
    return (data?.docs ?? []).filter((d) => d.key?.startsWith("/works/")).map(fromDoc);
  },

  async getBook(workKey: string) {
    const work = await cachedJson<{
      key: string; title: string; subtitle?: string; description?: unknown; covers?: number[];
      subjects?: string[]; authors?: { author: { key: string } }[]; first_publish_date?: string;
    }>(`${BASE}/works/${workKey}.json`, 60 * 60 * 24 * 7);
    if (!work) return null;
    // Search gives us the aggregate fields (year, pages, isbn, ratings) the work record lacks.
    const [doc] = (await cachedJson<{ docs: OLDoc[] }>(`${BASE}/search.json?q=key:/works/${workKey}&fields=${FIELDS}&limit=1`, 60 * 60 * 24))?.docs ?? [];
    const base: ExternalBook = doc ? fromDoc(doc) : {
      source: "openlibrary", externalId: workKey, title: work.title, authors: [], subjects: [],
    };
    if (!base.authors.length && work.authors) {
      const refs = await Promise.all(
        work.authors.slice(0, 4).map(async (a) => {
          const id = stripKey(a.author.key);
          const au = await cachedJson<{ name: string }>(`${BASE}/authors/${id}.json`, 60 * 60 * 24 * 30);
          return { name: au?.name ?? "Unknown", externalId: id };
        }),
      );
      base.authors = refs;
    }
    const desc = textOf(work.description);
    return {
      ...base,
      title: work.title ?? base.title,
      subtitle: work.subtitle ?? base.subtitle ?? null,
      coverId: base.coverId ?? work.covers?.find((c) => c > 0) ?? null,
      subjects: base.subjects.length ? base.subjects : cleanSubjects(work.subjects),
      firstPublishYear: base.firstPublishYear ?? (work.first_publish_date ? parseInt(work.first_publish_date.slice(-4)) || null : null),
      description: desc ? desc.split(/\r?\n-{3,}|\r?\n\r?\n\(\[source\]|\r?\n\r?\nAlso contained in/)[0].trim() : null,
    };
  },

  async searchAuthors(query: string, opts = {}) {
    const data = await cachedJson<{
      docs: { key: string; name: string; birth_date?: string; death_date?: string; top_work?: string; work_count?: number }[];
    }>(`${BASE}/search/authors.json?q=${encodeURIComponent(query)}&limit=${opts.limit ?? 10}`, 60 * 60 * 6);
    return (data?.docs ?? []).map<ExternalAuthor>((d) => ({
      source: "openlibrary", externalId: d.key, name: d.name, birthDate: d.birth_date ?? null,
      deathDate: d.death_date ?? null, topWork: d.top_work ?? null, workCount: d.work_count ?? null,
    }));
  },

  async getAuthor(key: string) {
    const a = await cachedJson<{ name: string; birth_date?: string; death_date?: string; bio?: unknown; photos?: number[] }>(
      `${BASE}/authors/${key}.json`, 60 * 60 * 24 * 30,
    );
    if (!a) return null;
    return {
      source: "openlibrary", externalId: key, name: a.name, birthDate: a.birth_date ?? null, deathDate: a.death_date ?? null,
      bio: textOf(a.bio), photoId: a.photos?.find((p) => p > 0) ?? null,
    };
  },

  async getAuthorWorks(key: string, opts = {}) {
    const data = await cachedJson<{ docs: OLDoc[] }>(
      `${BASE}/search.json?author=${key}&sort=readinglog&fields=${FIELDS}&limit=${opts.limit ?? 24}`, 60 * 60 * 24,
    );
    return (data?.docs ?? []).map(fromDoc);
  },
};
