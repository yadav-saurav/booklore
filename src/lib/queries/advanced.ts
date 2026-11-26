/**
 * Advanced title search: URL params → validated filters → parameterised SQL fragments.
 *
 * Pure module (no DB, no "server-only") so it can be unit-tested. Every user value reaches SQL
 * only through `?` placeholders; sort keys and directions come from fixed whitelists.
 * Callers compose the fragments with CARD_COLUMNS:
 *   SELECT ${CARD_COLUMNS} FROM books b WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?
 */

export const ADV_SORTS = ["popularity", "rating", "votes", "year", "title", "pages"] as const;
export type AdvSort = (typeof ADV_SORTS)[number];
export const ADV_PAGE_SIZE = 50;
export const ADV_MAX_GENRES = 10;

export const ADV_SORT_LABELS: Record<AdvSort, string> = {
  popularity: "Popularity",
  rating: "BOOKLORE rating",
  votes: "Number of ratings",
  year: "Year",
  title: "Title",
  pages: "Pages",
};

/** Expression + natural direction for each sort. Nulls always sort last. */
const SORT_SQL: Record<AdvSort, { expr: string; dir: "asc" | "desc" }> = {
  popularity: { expr: "b.popularity_rank", dir: "asc" },
  rating: { expr: "b.rating_avg", dir: "desc" },
  votes: { expr: "b.rating_count", dir: "desc" },
  year: { expr: "b.first_publish_year", dir: "desc" },
  title: { expr: "b.title COLLATE NOCASE", dir: "asc" },
  pages: { expr: "b.pages", dir: "desc" },
};

export type AdvancedFilters = {
  title: string;
  author: string;
  keyword: string;
  subject: string;
  genres: string[]; // slugs; a book must carry every selected genre
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  votesMin: number | null;
  pagesMin: number | null;
  pagesMax: number | null;
  language: string;
  list: boolean; // only books on the signed-in user's Reading List
  unrated: boolean; // hide books the signed-in user has rated
  sort: AdvSort;
  dir: "asc" | "desc";
  page: number;
};

export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

function intIn(v: string, min: number, max: number): number | null {
  if (!/^-?\d{1,6}$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

function ratingIn(v: string): number | null {
  if (!/^\d{1,2}(\.\d)?$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= 1 && n <= 10 ? Math.round(n * 10) / 10 : null;
}

const text = (v: string) => v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);

/** Parse URL params into validated filters. Anything invalid is dropped, never passed through. */
export function parseAdvanced(raw: RawParams): AdvancedFilters {
  const sortRaw = first(raw.sort);
  const sort: AdvSort = (ADV_SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as AdvSort) : "popularity";
  const dirRaw = first(raw.dir);
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : SORT_SQL[sort].dir;

  const genres = [...new Set((Array.isArray(raw.genre) ? raw.genre : raw.genre ? [raw.genre] : []).filter((g) => /^[a-z0-9-]{1,40}$/.test(g)))].slice(0, ADV_MAX_GENRES);

  const lang = first(raw.lang).trim().toLowerCase();
  const pageN = intIn(first(raw.page), 1, 10_000);

  let yearFrom = intIn(first(raw.yearFrom), 0, 3000);
  let yearTo = intIn(first(raw.yearTo), 0, 3000);
  if (yearFrom != null && yearTo != null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];

  let ratingMin = ratingIn(first(raw.ratingMin));
  let ratingMax = ratingIn(first(raw.ratingMax));
  if (ratingMin != null && ratingMax != null && ratingMin > ratingMax) [ratingMin, ratingMax] = [ratingMax, ratingMin];

  let pagesMin = intIn(first(raw.pagesMin), 0, 100_000);
  let pagesMax = intIn(first(raw.pagesMax), 0, 100_000);
  if (pagesMin != null && pagesMax != null && pagesMin > pagesMax) [pagesMin, pagesMax] = [pagesMax, pagesMin];

  return {
    title: text(first(raw.title)),
    author: text(first(raw.author)),
    keyword: text(first(raw.kw)),
    subject: text(first(raw.subject)),
    genres,
    yearFrom,
    yearTo,
    ratingMin,
    ratingMax,
    votesMin: intIn(first(raw.votesMin), 0, 10_000_000),
    pagesMin,
    pagesMax,
    language: /^[a-z]{2,3}$/.test(lang) ? lang : "",
    list: first(raw.list) === "1",
    unrated: first(raw.unrated) === "1",
    sort,
    dir,
    page: pageN ?? 1,
  };
}

/** Non-default filter values as [name, value] pairs, in a stable order (for links and the form). */
export function filtersToEntries(f: AdvancedFilters): [string, string][] {
  const out: [string, string][] = [];
  const add = (k: string, v: string | number | null | undefined | boolean) => {
    if (v === null || v === undefined || v === "" || v === false) return;
    out.push([k, v === true ? "1" : String(v)]);
  };
  add("title", f.title);
  add("author", f.author);
  add("kw", f.keyword);
  add("subject", f.subject);
  for (const g of f.genres) add("genre", g);
  add("yearFrom", f.yearFrom);
  add("yearTo", f.yearTo);
  add("ratingMin", f.ratingMin);
  add("ratingMax", f.ratingMax);
  add("votesMin", f.votesMin);
  add("pagesMin", f.pagesMin);
  add("pagesMax", f.pagesMax);
  add("lang", f.language);
  add("list", f.list);
  add("unrated", f.unrated);
  if (f.sort !== "popularity") add("sort", f.sort);
  if (f.dir !== SORT_SQL[f.sort].dir) add("dir", f.dir);
  if (f.page > 1) add("page", f.page);
  return out;
}

export type FilterChip = { label: string; name: string; value?: string };

/** One chip per active filter. Removing a chip drops `name` (and `value`, for genres) from the URL. */
export function activeChips(f: AdvancedFilters, genreName: (slug: string) => string = (s) => s): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.title) chips.push({ label: `Title: ${f.title}`, name: "title" });
  if (f.author) chips.push({ label: `Author: ${f.author}`, name: "author" });
  if (f.keyword) chips.push({ label: `Keyword: ${f.keyword}`, name: "kw" });
  if (f.subject) chips.push({ label: `Subject: ${f.subject}`, name: "subject" });
  for (const g of f.genres) chips.push({ label: `Genre: ${genreName(g)}`, name: "genre", value: g });
  if (f.yearFrom != null || f.yearTo != null)
    chips.push({ label: `Year: ${f.yearFrom ?? "any"}–${f.yearTo ?? "any"}`, name: "yearFrom" });
  if (f.ratingMin != null || f.ratingMax != null)
    chips.push({ label: `Rating: ${f.ratingMin ?? 1}–${f.ratingMax ?? 10}`, name: "ratingMin" });
  if (f.votesMin != null) chips.push({ label: `Ratings ≥ ${f.votesMin}`, name: "votesMin" });
  if (f.pagesMin != null || f.pagesMax != null)
    chips.push({ label: `Pages: ${f.pagesMin ?? 0}–${f.pagesMax ?? "any"}`, name: "pagesMin" });
  if (f.language) chips.push({ label: `Language: ${f.language}`, name: "lang" });
  if (f.list) chips.push({ label: "On my Reading List", name: "list" });
  if (f.unrated) chips.push({ label: "Not rated by me", name: "unrated" });
  return chips;
}

/** Names that a chip with the given `name` removes from the URL. */
export function chipRemoveNames(name: string): string[] {
  switch (name) {
    case "yearFrom":
    case "yearTo":
      return ["yearFrom", "yearTo"];
    case "ratingMin":
    case "ratingMax":
      return ["ratingMin", "ratingMax"];
    case "pagesMin":
    case "pagesMax":
      return ["pagesMin", "pagesMax"];
    default:
      return [name];
  }
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** FTS5 prefix query from free text: "dune herb" → `"dune"* "herb"*` (letters and digits only). */
export function ftsTerms(q: string): string | null {
  const terms = q.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]+/gu);
  if (!terms?.length) return null;
  return terms.slice(0, 8).map((t) => `"${t}"*`).join(" ");
}

export type AdvancedQuery = {
  where: string;
  params: (string | number)[];
  orderBy: string;
};

/**
 * Build the WHERE / ORDER BY for the filters. `userId` is only needed for the two personal
 * filters (Reading List, not rated); without it those filters are ignored.
 */
export function buildAdvancedQuery(f: AdvancedFilters, userId?: number | null): AdvancedQuery {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  const like = (v: string) => `%${escapeLike(v)}%`;

  if (f.title) {
    clauses.push(`(b.title LIKE ? ESCAPE '\\' OR b.subtitle LIKE ? ESCAPE '\\')`);
    params.push(like(f.title), like(f.title));
  }
  if (f.author) {
    clauses.push(`EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id AND a.name LIKE ? ESCAPE '\\')`);
    params.push(like(f.author));
  }
  if (f.keyword) {
    const fts = ftsTerms(f.keyword);
    if (fts) {
      clauses.push(`b.id IN (SELECT book_id FROM books_fts WHERE books_fts MATCH ?)`);
      params.push(fts);
    }
  }
  if (f.subject) {
    clauses.push(`b.subjects LIKE ? ESCAPE '\\'`);
    params.push(like(f.subject));
  }
  for (const g of f.genres) {
    clauses.push(`EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_slug = ?)`);
    params.push(g);
  }
  if (f.yearFrom != null) { clauses.push(`b.first_publish_year >= ?`); params.push(f.yearFrom); }
  if (f.yearTo != null) { clauses.push(`b.first_publish_year <= ?`); params.push(f.yearTo); }
  if (f.ratingMin != null) { clauses.push(`b.rating_avg >= ?`); params.push(f.ratingMin); }
  if (f.ratingMax != null) { clauses.push(`b.rating_avg <= ?`); params.push(f.ratingMax); }
  if (f.votesMin != null) { clauses.push(`b.rating_count >= ?`); params.push(f.votesMin); }
  if (f.pagesMin != null) { clauses.push(`b.pages >= ?`); params.push(f.pagesMin); }
  if (f.pagesMax != null) { clauses.push(`b.pages <= ?`); params.push(f.pagesMax); }
  if (f.language) { clauses.push(`b.language = ?`); params.push(f.language); }
  if (userId) {
    if (f.list) {
      clauses.push(`EXISTS (SELECT 1 FROM shelf s WHERE s.book_id = b.id AND s.user_id = ? AND s.status = 'want')`);
      params.push(userId);
    }
    if (f.unrated) {
      clauses.push(`NOT EXISTS (SELECT 1 FROM ratings r WHERE r.book_id = b.id AND r.user_id = ?)`);
      params.push(userId);
    }
  }

  const { expr, dir: natural } = SORT_SQL[f.sort];
  const d = (f.dir ?? natural).toUpperCase();
  const orderBy = `(${expr}) IS NULL, ${expr} ${d}, b.id ASC`;

  return { where: clauses.length ? clauses.join(" AND ") : "1 = 1", params, orderBy };
}
