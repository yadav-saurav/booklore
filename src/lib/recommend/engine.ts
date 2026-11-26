import "server-only";
import { db } from "@/db";
import { loadContent, loadCF, contentSim, type ContentModel, type CFModel } from "./model";
import { mmr, scoreFromNeighbours, sparseCosine, jaccard, type SparseVec } from "./math";

/**
 * Hybrid recommender: item–item CF (from ./model, cached) + content similarity (genres, subject TF-IDF,
 * author, era) + a small quality prior, diversified with MMR. All results are book ids + reason strings;
 * src/lib/recommend.ts turns them into BookCards.
 */

export type Scored = { id: string; score: number; reason: string | null };

const COLD_START_MIN_RATINGS = 3;
const MMR_LAMBDA = 0.75;
const SHELF_WEIGHT = 0.2; // 'want' / 'reading' as weak positives
const GLOBAL_PRIOR_K = 4; // shrink the user mean towards the global mean

type UserData = {
  ratings: { bookId: string; score: number; updatedAt: number }[];
  shelf: { bookId: string; status: string }[];
};

async function loadUser(userId: number): Promise<UserData> {
  const [ratings, shelf] = await Promise.all([
    db.all<UserData["ratings"][number]>(`SELECT book_id bookId, score, updated_at updatedAt FROM ratings WHERE user_id = ?`, userId),
    db.all<UserData["shelf"][number]>(`SELECT book_id bookId, status FROM shelf WHERE user_id = ?`, userId),
  ]);
  return { ratings, shelf };
}

/** Seen = rated or shelved in any status. */
function seenSet(c: ContentModel, u: UserData): Set<number> {
  const s = new Set<number>();
  for (const r of u.ratings) { const i = c.index.get(r.bookId); if (i !== undefined) s.add(i); }
  for (const r of u.shelf) { const i = c.index.get(r.bookId); if (i !== undefined) s.add(i); }
  return s;
}

/** Diversity kernel for MMR: same author counts as a near-duplicate; genres overlap partially. */
function diversitySim(c: ContentModel, a: number, b: number): number {
  const A = c.books[a], B = c.books[b];
  if (A.authors.some((x) => B.authors.includes(x))) return 1;
  return 0.6 * jaccard(A.genres, B.genres);
}

/* ───────── Similar books ───────── */

/**
 * Hybrid similarity for one item: α·CF + (1−α)·content, where α grows with the item's CF support
 * (number of ratings). Unrated / freshly imported books get α = 0 → content only.
 */
export async function similarIds(bookId: string, limit = 12, exclude?: Set<number>): Promise<Scored[]> {
  const c = await loadContent();
  const i = c.index.get(bookId);
  if (i === undefined) return [];
  const cf = await loadCF(c);
  const cfMap = new Map<number, number>();
  const ci = cf.itemOf[i];
  if (ci >= 0) for (const { j, s } of cf.neighbours[ci]) cfMap.set(cf.bookOf[j], s);
  const support = c.books[i].ratingCount;
  const alpha = cfMap.size ? (support / (support + 15)) * 0.7 : 0;

  const out: { j: number; score: number; cfPart: number }[] = [];
  for (let j = 0; j < c.books.length; j++) {
    if (j === i || exclude?.has(j)) continue;
    const cs = contentSim(c, i, j);
    const cfs = Math.min(1, 1.6 * (cfMap.get(j) ?? 0));
    if (cs <= 0.02 && cfs <= 0) continue;
    const score = alpha * cfs + (1 - alpha) * cs + 0.04 * c.quality[j];
    out.push({ j, score, cfPart: alpha * cfs });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map(({ j, score, cfPart }) => ({
    id: c.books[j].id, score,
    reason: cfPart > score * 0.5 ? `Readers of ${c.books[i].title} also loved this` : `Similar to ${c.books[i].title}`,
  }));
}

/* ───────── Personal picks ───────── */

type Profile = { i: number; w: number; score: number | null; status: string | null }[];

function buildProfile(c: ContentModel, cf: CFModel, u: UserData): Profile {
  const n = u.ratings.length;
  const raw = n ? u.ratings.reduce((s, r) => s + r.score, 0) / n : cf.globalMean;
  const mu = (n * raw + GLOBAL_PRIOR_K * cf.globalMean) / (n + GLOBAL_PRIOR_K);
  const prof: Profile = [];
  const rated = new Set<string>();
  for (const r of u.ratings) {
    const i = c.index.get(r.bookId);
    if (i === undefined) continue;
    rated.add(r.bookId);
    // (score − userMean), but a 7+ on a 1–10 scale is never treated as a dislike (site mean runs ~8).
    const centred = (r.score - mu) / 2;
    prof.push({ i, w: r.score >= 7 ? Math.max(centred, 0.2) : centred, score: r.score, status: null });
  }
  for (const s of u.shelf) {
    if (rated.has(s.bookId) || (s.status !== "want" && s.status !== "reading")) continue;
    const i = c.index.get(s.bookId);
    if (i !== undefined) prof.push({ i, w: SHELF_WEIGHT * (s.status === "reading" ? 1 : 0.8), score: null, status: s.status });
  }
  return prof;
}

/** Genre and subject taste vectors (signed, weighted by profile weights). */
function tasteVectors(c: ContentModel, prof: Profile) {
  const genre = new Map<string, number>();
  const subj: SparseVec = new Map();
  const author = new Map<string, number>();
  for (const { i, w } of prof) {
    const b = c.books[i];
    for (const g of b.genres) genre.set(g, (genre.get(g) ?? 0) + w);
    for (const a of b.authors) author.set(a, (author.get(a) ?? 0) + w);
    for (const [t, v] of c.tfidf[i]) subj.set(t, (subj.get(t) ?? 0) + w * v);
  }
  return { genre, subj, author };
}

export async function favouriteGenres(userId: number, n = 3): Promise<string[]> {
  const c = await loadContent(); const cf = await loadCF(c);
  const prof = buildProfile(c, cf, await loadUser(userId));
  const { genre } = tasteVectors(c, prof);
  return [...genre].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([g]) => g);
}

export async function ratingCount(userId: number): Promise<number> {
  return (await db.get<{ n: number }>(`SELECT count(*) n FROM ratings WHERE user_id = ?`, userId))?.n ?? 0;
}

export async function recommendIds(userId: number | null, limit = 24): Promise<Scored[]> {
  const c = await loadContent();
  if (!c.books.length) return [];
  const u = userId ? await loadUser(userId) : { ratings: [], shelf: [] };
  const seen = seenSet(c, u);
  if (u.ratings.length < COLD_START_MIN_RATINGS) return coldStart(c, seen, limit);

  const cf = await loadCF(c);
  const prof = buildProfile(c, cf, u);
  const { genre, subj, author } = tasteVectors(c, prof);

  // CF: aggregate neighbour similarity over the profile (in CF item space).
  const cfProfile = prof.map((p) => ({ i: cf.itemOf[p.i], w: p.w })).filter((p) => p.i >= 0);
  const cfSeen = new Set<number>([...seen].map((i) => cf.itemOf[i]).filter((x) => x >= 0));
  const acc = scoreFromNeighbours(cfProfile, cf.neighbours, cfSeen);
  let cfMax = 0;
  const cfScore = new Map<number, { v: number; top: number }>();
  for (const [j, a] of acc) {
    const v = a.sum / Math.sqrt(1 + a.supp); // favour agreement from several profile items, damp single hits
    if (v <= 0) continue;
    const bi = cf.bookOf[j];
    cfScore.set(bi, { v, top: cf.bookOf[a.top] });
    cfMax = Math.max(cfMax, v);
  }

  // Content affinity: cosine of the candidate's genre set and subject vector with the taste vectors.
  const gNorm = Math.sqrt([...genre.values()].reduce((s, v) => s + v * v, 0)) || 1;
  const posAuthors = new Set([...author].filter(([, v]) => v > 0.3).map(([a]) => a));
  const content = new Float64Array(c.books.length);
  let contentMax = 0;
  for (let j = 0; j < c.books.length; j++) {
    if (seen.has(j)) continue;
    const b = c.books[j];
    let g = 0;
    for (const x of b.genres) g += genre.get(x) ?? 0;
    g = b.genres.length ? g / (gNorm * Math.sqrt(b.genres.length)) : 0;
    const s = sparseCosine(c.tfidf[j], subj);
    const a = b.authors.some((x) => posAuthors.has(x)) ? 0.15 : 0;
    content[j] = Math.max(0, 0.55 * g + 0.45 * s + a);
    contentMax = Math.max(contentMax, content[j]);
  }

  const cands: { j: number; rel: number; cfPart: number; top: number }[] = [];
  for (let j = 0; j < c.books.length; j++) {
    if (seen.has(j)) continue;
    const cfv = cfScore.get(j);
    const coN = contentMax ? content[j] / contentMax : 0;
    // With ~20 ratings per book CF is noisy: let content affinity gate it so stray neighbours
    // (a self-help title loosely co-rated with Dune) don't outrank on-taste books.
    const cfN = cfv && cfMax ? (cfv.v / cfMax) * (0.35 + 0.65 * Math.min(1, coN / 0.5)) : 0;
    const rel = 0.45 * cfN + 0.45 * coN + 0.1 * c.quality[j];
    if (rel <= 0.05) continue;
    cands.push({ j, rel, cfPart: 0.45 * cfN, top: cfv?.top ?? -1 });
  }
  cands.sort((a, b) => b.rel - a.rel);
  // Relevance floor keeps MMR from reaching for off-taste filler.
  const floor = (cands[0]?.rel ?? 0) * 0.4;
  const pool = cands.slice(0, Math.max(limit * 4, 80)).filter((x, n) => n < limit * 1.5 || x.rel >= floor);
  const picked = mmr(pool, (x) => x.rel, (a, b) => diversitySim(c, a.j, b.j), limit, MMR_LAMBDA);

  const favGenre = [...genre].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const used = new Map<string, number>();
  return picked.map((p) => {
    // Vary the chips: after a "Because you rated X" line has been used 3 times, explain by genre instead.
    let reason = reasonFor(c, p, prof, favGenre, false);
    if ((used.get(reason) ?? 0) >= 3) reason = reasonFor(c, p, prof, favGenre, true);
    used.set(reason, (used.get(reason) ?? 0) + 1);
    return { id: c.books[p.j].id, score: p.rel, reason };
  });
}

function reasonFor(c: ContentModel, p: { j: number; rel: number; cfPart: number; top: number }, prof: Profile, favGenre: [string, number][], genreOnly: boolean): string {
  const b = c.books[p.j];
  if (!genreOnly && p.top >= 0 && p.cfPart >= p.rel * 0.45) {
    const pr = prof.find((x) => x.i === p.top);
    const t = c.books[p.top].title;
    if (pr?.score != null) return `Because you rated ${t} ${pr.score}/10`;
    if (pr?.status === "reading") return `Because you're reading ${t}`;
    if (pr?.status === "want") return `Because ${t} is on your Reading List`;
  }
  const g = favGenre.find(([slug]) => b.genres.includes(slug))?.[0];
  if (g) return c.popular[p.j] ? `Popular with readers who love ${c.genreName(g)}` : `Because you like ${c.genreName(g)}`;
  return `Highly rated in ${c.genreName(b.genres[0])}`;
}

/** Cold start: popular, high weighted_score books diversified across genres. */
function coldStart(c: ContentModel, seen: Set<number>, limit: number, genre?: string): Scored[] {
  const cands: { j: number; rel: number }[] = [];
  for (let j = 0; j < c.books.length; j++) {
    if (seen.has(j)) continue;
    if (genre && !c.books[j].genres.includes(genre)) continue;
    cands.push({ j, rel: 0.6 * c.quality[j] + 0.4 * c.pop[j] });
  }
  cands.sort((a, b) => b.rel - a.rel);
  const picked = mmr(cands.slice(0, Math.max(limit * 5, 100)), (x) => x.rel, (a, b) => diversitySim(c, a.j, b.j), limit, genre ? 0.85 : 0.7);
  return picked.map(({ j, rel }) => {
    const g = genre ?? c.books[j].genres[0];
    return { id: c.books[j].id, score: rel, reason: c.popular[j] && c.quality[j] < 0.75 ? `Popular in ${c.genreName(g)}` : `Highly rated in ${c.genreName(g)}` };
  });
}

/** Popular + highly rated in one genre, excluding what the user has seen. */
export async function popularInGenreIds(userId: number | null, genre: string, limit = 12): Promise<Scored[]> {
  const c = await loadContent();
  const seen = userId ? seenSet(c, await loadUser(userId)) : new Set<number>();
  return coldStart(c, seen, limit, genre);
}

/** Books for the onboarding "rate what you've read" grid: widely read, diverse, unseen. */
export async function onboardingIds(userId: number | null, limit = 24): Promise<string[]> {
  const c = await loadContent();
  const seen = userId ? seenSet(c, await loadUser(userId)) : new Set<number>();
  const cands: { j: number; rel: number }[] = [];
  for (let j = 0; j < c.books.length; j++) if (!seen.has(j)) cands.push({ j, rel: 0.75 * c.pop[j] + 0.25 * c.quality[j] });
  cands.sort((a, b) => b.rel - a.rel);
  return mmr(cands.slice(0, 150), (x) => x.rel, (a, b) => diversitySim(c, a.j, b.j), limit, 0.6).map((x) => c.books[x.j].id);
}

/** "Because you rated X": top-rated recent seeds, each with similar unseen books (deduped across rails). */
export async function becauseYouRatedIds(userId: number, rails = 2, perRail = 12): Promise<{ seed: string; score: number; items: Scored[] }[]> {
  const c = await loadContent();
  const u = await loadUser(userId);
  if (!u.ratings.length) return [];
  const seen = seenSet(c, u);
  const mean = u.ratings.reduce((s, r) => s + r.score, 0) / u.ratings.length;
  const seeds = u.ratings
    .filter((r) => r.score >= Math.max(7, Math.round(mean)) && c.index.has(r.bookId))
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  const out: { seed: string; score: number; items: Scored[] }[] = [];
  const used = new Set(seen);
  const seedAuthors = new Set<string>();
  for (const s of seeds) {
    if (out.length >= rails) break;
    const b = c.books[c.index.get(s.bookId)!];
    if (b.authors.some((a) => seedAuthors.has(a))) continue; // one rail per author
    const items = await similarIds(s.bookId, perRail, used);
    if (items.length < Math.min(4, perRail)) continue;
    for (const it of items) used.add(c.index.get(it.id)!);
    b.authors.forEach((a) => seedAuthors.add(a));
    out.push({ seed: s.bookId, score: s.score, items: items.map((x) => ({ ...x, reason: `Because you rated ${b.title} ${s.score}/10` })) });
  }
  return out;
}
