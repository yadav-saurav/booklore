import "server-only";
import { db } from "@/db";
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

async function contentSig(): Promise<string> {
  const r = (await db.get<Record<string, number | null>>(`SELECT (SELECT count(*) FROM books) a, (SELECT max(created_at) FROM books) b,
    (SELECT count(*) FROM book_genres) c, (SELECT count(*) FROM book_authors) d`))!;
  return `${r.a}|${r.b}|${r.c}|${r.d}`;
}

export async function ratingsSig(): Promise<string> {
  const r = (await db.get<{ n: number; m: number | null; t: number }>(`SELECT count(*) n, max(updated_at) m, coalesce(sum(score), 0) t FROM ratings`))!;
  return `${r.n}|${r.m}|${r.t}`;
}

/** Concurrent requests share one in-flight rebuild instead of each scanning the tables. */
let contentBuild: Promise<ContentModel> | null = null;
let cfBuild: Promise<CFModel> | null = null;

export async function loadContent(): Promise<ContentModel> {
  const sig = await contentSig();
  if (cache.content?.sig === sig) return cache.content;
  if (!contentBuild) contentBuild = buildContent(sig).finally(() => { contentBuild = null; });
  return contentBuild;
}

async function buildContent(sig: string): Promise<ContentModel> {
  const rows = await db.all<{ id: string; title: string; year: number | null; subjects: string; rc: number; ws: number | null; ps: number; sc: number; gcsv: string | null; acsv: string | null }>(`SELECT b.id, b.title, b.first_publish_year AS year, b.subjects, b.rating_count AS rc,
      b.weighted_score ws, b.popularity_score ps, b.shelf_count sc,
      (SELECT string_agg(genre_slug, ',') FROM book_genres bg WHERE bg.book_id = b.id) gcsv,
      (SELECT string_agg(author_id, ',' ORDER BY ba.position) FROM book_authors ba WHERE ba.book_id = b.id) acsv
    FROM books b ORDER BY b.id`);
  const names = new Map((await db.all<{ slug: string; name: string }>(`SELECT slug, name FROM genres`)).map((x) => [x.slug, x.name]));

  const books: ContentBook[] = rows.map((r) => ({
    id: r.id, title: r.title, year: r.year, ratingCount: r.rc,
    genres: r.gcsv ? r.gcsv.split(",") : [], authors: r.acsv ? r.acsv.split(",") : [],
  }));
  const docs = rows.map((r) => {
    let subj: string[] = [];
    try { subj = typeof r.subjects === "string" ? JSON.parse(r.subjects || "[]") : (r.subjects ?? []); } catch { /* ignore */ }
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

  return (cache.content = {
    sig, books, index: new Map(books.map((b, i) => [b.id, i])), tfidf: vecs, quality, pop, popular,
    genreName: (s) => (s ? names.get(s) ?? s : "the archive"),
  });
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

export async function loadCF(content?: ContentModel): Promise<CFModel> {
  const c = content ?? (await loadContent());
  const sig = await ratingsSig();
  if (cache.cf && cache.cf.sig === sig && cache.cf.content === c) return cache.cf;
  if (!cfBuild) {
    cfBuild = (async () => {
      const t0 = performance.now();
      const rows = await db.all<{ u: number; b: string; r: number }>(`SELECT user_id u, book_id b, score r FROM ratings`);
      const cf = buildCF(c, rows, sig);
      cf.buildMs = performance.now() - t0; // include the scan
      cache.cf = cf;
      return cf;
    })().finally(() => { cfBuild = null; });
  }
  return cfBuild;
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
