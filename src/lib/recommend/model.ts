import "server-only";
import { sqlite } from "@/db";
import { itemItemCF, tfidf, tokenize, jaccard, sparseCosine, eraProximity, type Neighbour, type SparseVec, type RatingTriple } from "./math";

/**
 * Module-level caches for the recommender. Both models are rebuilt from one SQL scan each:
 *  - ContentModel: books, genres, authors, subject TF-IDF, quality/popularity priors.
 *    Invalidated when the catalog changes (book count / newest created_at / genre links).
 *  - CFModel: item–item neighbours. Invalidated when `count(*), max(updated_at)` of ratings changes
 *    (plus total(score), which catches same-second re-rates).
 */

export type ContentBook = { id: string; title: string; year: number | null; genres: string[]; authors: string[]; ratingCount: number };

export type ContentModel = {
  sig: string;
  books: ContentBook[];
  index: Map<string, number>;
  tfidf: SparseVec[];
  quality: Float64Array; // weighted_score normalised to [0,1] across the catalog
  pop: Float64Array; // popularity normalised to [0,1]
  popular: Uint8Array; // top ~20% by popularity
  genreName: (slug: string | undefined) => string;
};

export type CFModel = {
  sig: string;
  content: ContentModel;
  globalMean: number;
  itemOf: Int32Array; // content index → CF item index (−1 when unrated)
  bookOf: Int32Array; // CF item index → content index
  neighbours: Neighbour[][];
  buildMs: number;
  nRatings: number;
};

const g = globalThis as unknown as { __blRec?: { content?: ContentModel; cf?: CFModel } };
const cache = (g.__blRec ??= {});

export const CF_PARAMS = { lambda: 12, k: 50, minCo: 3, minSim: 0.06 };

function contentSig(): string {
  const r = sqlite.prepare(`SELECT (SELECT count(*) FROM books) a, (SELECT max(created_at) FROM books) b,
    (SELECT count(*) FROM book_genres) c, (SELECT count(*) FROM book_authors) d`).get() as Record<string, number | null>;
  return `${r.a}|${r.b}|${r.c}|${r.d}`;
}

export function ratingsSig(): string {
  const r = sqlite.prepare(`SELECT count(*) n, max(updated_at) m, total(score) t FROM ratings`).get() as { n: number; m: number | null; t: number };
  return `${r.n}|${r.m}|${r.t}`;
}

export function loadContent(): ContentModel {
  const sig = contentSig();
  if (cache.content?.sig === sig) return cache.content;
  const rows = sqlite.prepare(`SELECT b.id, b.title, b.first_publish_year year, b.subjects, b.rating_count rc,
      b.weighted_score ws, b.popularity_score ps, b.shelf_count sc,
      (SELECT group_concat(genre_slug) FROM book_genres bg WHERE bg.book_id = b.id) gcsv,
      (SELECT group_concat(author_id) FROM book_authors ba WHERE ba.book_id = b.id) acsv
    FROM books b`).all() as { id: string; title: string; year: number | null; subjects: string; rc: number; ws: number | null; ps: number; sc: number; gcsv: string | null; acsv: string | null }[];
  const names = new Map((sqlite.prepare(`SELECT slug, name FROM genres`).all() as { slug: string; name: string }[]).map((x) => [x.slug, x.name]));

  const books: ContentBook[] = rows.map((r) => ({
    id: r.id, title: r.title, year: r.year, ratingCount: r.rc,
    genres: r.gcsv ? r.gcsv.split(",") : [], authors: r.acsv ? r.acsv.split(",") : [],
  }));
  const docs = rows.map((r) => {
    let subj: string[] = [];
    try { subj = JSON.parse(r.subjects || "[]"); } catch { /* ignore */ }
    return tokenize(subj.join(" "));
  });
  const { vecs } = tfidf(docs);

  const norm01 = (xs: number[]) => {
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return Float64Array.from(xs, (x) => (hi > lo ? (x - lo) / (hi - lo) : 0.5));
  };
  const wsVals = rows.map((r) => r.ws).filter((x): x is number => x != null);
  const wsFloor = wsVals.length ? Math.min(...wsVals) : 0;
  const quality = norm01(rows.map((r) => r.ws ?? wsFloor));
  const pop = norm01(rows.map((r) => Math.log1p(r.ps) + 0.5 * Math.log1p(r.rc + r.sc)));
  const cut = [...pop].sort((a, b) => b - a)[Math.floor(pop.length * 0.2)] ?? 1;
  const popular = Uint8Array.from(pop, (p) => (p >= cut ? 1 : 0));

  cache.content = {
    sig, books, index: new Map(books.map((b, i) => [b.id, i])), tfidf: vecs, quality, pop, popular,
    genreName: (s) => (s ? names.get(s) ?? s : "the archive"),
  };
  return cache.content;
}

/** Build item–item CF from one ratings scan. Pure function of (content model, rating rows). */
export function buildCF(content: ContentModel, rows: { u: number; b: string; r: number }[], sig = ""): CFModel {
  const t0 = performance.now();
  const itemOf = new Int32Array(content.books.length).fill(-1);
  const bookOfArr: number[] = [];
  const userIdx = new Map<number, number>();
  const triples: RatingTriple[] = [];
  let sum = 0;
  for (const { u, b, r } of rows) {
    const bi = content.index.get(b);
    if (bi === undefined) continue;
    if (itemOf[bi] < 0) { itemOf[bi] = bookOfArr.length; bookOfArr.push(bi); }
    let ui = userIdx.get(u);
    if (ui === undefined) { ui = userIdx.size; userIdx.set(u, ui); }
    triples.push({ u: ui, i: itemOf[bi], r });
    sum += r;
  }
  const neighbours = itemItemCF(triples, userIdx.size, bookOfArr.length, CF_PARAMS);
  return {
    sig, content, globalMean: triples.length ? sum / triples.length : 6.5,
    itemOf, bookOf: Int32Array.from(bookOfArr), neighbours,
    buildMs: performance.now() - t0, nRatings: triples.length,
  };
}

export function loadCF(content = loadContent()): CFModel {
  const sig = ratingsSig();
  if (cache.cf && cache.cf.sig === sig && cache.cf.content === content) return cache.cf;
  const t0 = performance.now();
  const rows = sqlite.prepare(`SELECT user_id u, book_id b, score r FROM ratings`).all() as { u: number; b: string; r: number }[];
  const cf = buildCF(content, rows, sig);
  cf.buildMs = performance.now() - t0; // include the scan
  cache.cf = cf;
  return cf;
}

/**
 * Content similarity in [0,1]: genre Jaccard + subject TF-IDF cosine, a same-author boost and a small
 * era-proximity term that only applies when the books already share something.
 */
export function contentSim(c: ContentModel, a: number, b: number): number {
  const A = c.books[a], B = c.books[b];
  const gj = jaccard(A.genres, B.genres);
  const tc = sparseCosine(c.tfidf[a], c.tfidf[b]);
  const base = 0.5 * gj + 0.5 * tc;
  if (base <= 0 && !A.authors.length) return 0;
  const author = A.authors.some((x) => B.authors.includes(x)) ? 0.2 : 0;
  const era = base > 0 ? 0.06 * eraProximity(A.year, B.year) : 0;
  return Math.min(1, base + author + era);
}
