import type { ShelfStatus } from "@/db/schema";

/** URL state for every list page. Pure helpers (usable on server and client). */
export type TitleView = "detailed" | "grid" | "compact";
export type SortKey = "order" | "title" | "rating" | "votes" | "popularity" | "year" | "pages" | "yours" | "rated";
export type SP = Record<string, string | string[] | undefined>;

export type ListState = {
  view: TitleView; sort: SortKey; dir: "asc" | "desc" | null; genres: string[]; statuses: ShelfStatus[];
  minRating: number | null; yearFrom: number | null; yearTo: number | null; score: number | null; edit: boolean;
};

export const SORT_LABELS: Record<SortKey, string> = {
  order: "List order", title: "Alphabetical", rating: "BOOKLORE rating", votes: "Number of ratings", popularity: "Popularity",
  year: "Publication year", pages: "Pages", yours: "Your rating", rated: "Date rated",
};

export const STATUS_LABELS: Record<ShelfStatus, string> = { want: "Want to Read", reading: "Reading", read: "Read" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const int = (v: string, lo: number, hi: number) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : null; };

export function parseListState(sp: SP, allowed: SortKey[]): ListState {
  const view = one(sp.view);
  const sort = one(sp.sort) as SortKey;
  const dir = one(sp.dir);
  return {
    view: view === "grid" || view === "compact" ? view : "detailed",
    sort: allowed.includes(sort) ? sort : allowed[0],
    dir: dir === "asc" || dir === "desc" ? dir : null,
    genres: one(sp.genre).split(",").filter((g) => /^[a-z0-9-]{1,40}$/.test(g)).slice(0, 10),
    statuses: one(sp.status).split(",").filter((s): s is ShelfStatus => s === "want" || s === "reading" || s === "read"),
    minRating: int(one(sp.min), 1, 9),
    yearFrom: int(one(sp.from), 0, 3000),
    yearTo: int(one(sp.to), 0, 3000),
    score: int(one(sp.score), 1, 10),
    edit: one(sp.edit) === "1",
  };
}

/** Serialise state back to a query string; `patch` overrides individual keys. */
export function listHref(path: string, s: ListState, patch: Partial<ListState> = {}, defaultSort: SortKey = "order"): string {
  const m = { ...s, ...patch };
  const q = new URLSearchParams();
  if (m.view !== "detailed") q.set("view", m.view);
  if (m.sort !== defaultSort) q.set("sort", m.sort);
  if (m.dir) q.set("dir", m.dir);
  if (m.genres.length) q.set("genre", m.genres.join(","));
  if (m.statuses.length) q.set("status", m.statuses.join(","));
  if (m.minRating) q.set("min", String(m.minRating));
  if (m.yearFrom) q.set("from", String(m.yearFrom));
  if (m.yearTo) q.set("to", String(m.yearTo));
  if (m.score) q.set("score", String(m.score));
  if (m.edit) q.set("edit", "1");
  const str = q.toString();
  return str ? `${path}?${str}` : path;
}

export const refineCount = (s: ListState) =>
  s.genres.length + s.statuses.length + (s.minRating ? 1 : 0) + (s.yearFrom || s.yearTo ? 1 : 0) + (s.score ? 1 : 0);

const NATURAL: Record<SortKey, "asc" | "desc"> = {
  order: "desc", title: "asc", rating: "desc", votes: "desc", popularity: "asc", year: "desc", pages: "desc", yours: "desc", rated: "desc",
};
/** Natural direction of a sort; "order" is ascending for user lists (list position) and descending elsewhere (newest first). */
export const TITLE_SORT_DIR_ORDER = (sort: SortKey, isList: boolean): "asc" | "desc" => (sort === "order" && isList ? "asc" : NATURAL[sort]);
