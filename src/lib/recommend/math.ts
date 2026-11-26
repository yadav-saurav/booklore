/**
 * Pure recommender math (no DB, no server-only) so it can be unit-tested with tiny fixtures.
 * Items and users are dense integer indices; similarity lists are sparse.
 */

export type RatingTriple = { u: number; i: number; r: number };
export type Neighbour = { j: number; s: number; n: number };
export type SparseVec = Map<number, number>;

/** Per-user mean rating. */
export function userMeans(ratings: RatingTriple[], nUsers: number): Float64Array {
  const sum = new Float64Array(nUsers);
  const cnt = new Float64Array(nUsers);
  for (const { u, r } of ratings) { sum[u] += r; cnt[u]++; }
  for (let u = 0; u < nUsers; u++) sum[u] = cnt[u] ? sum[u] / cnt[u] : 0;
  return sum;
}

/** Shrink a similarity estimated from n co-raters towards 0: s · n / (n + λ). */
export const shrink = (s: number, n: number, lambda: number) => (s * n) / (n + lambda);

/** Cosine between two sparse vectors. */
export function sparseCosine(a: SparseVec, b: SparseVec): number {
  if (!a.size || !b.size) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of small) { const w = big.get(k); if (w !== undefined) dot += v * w; }
  if (!dot) return 0;
  return dot / (norm(a) * norm(b));
}

export function norm(a: SparseVec): number {
  let s = 0;
  for (const v of a.values()) s += v * v;
  return Math.sqrt(s);
}

export function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Item–item adjusted cosine on user-mean-centred ratings.
 * sim(i,j) = Σ_u (r_ui − μ_u)(r_uj − μ_u) / (‖i‖·‖j‖), with norms over each item's full centred column
 * (the usual "pearson-baseline"-style variant that penalises low overlap), then shrinkage n/(n+λ).
 * Keeps the top-K positive neighbours per item.
 */
export function itemItemCF(
  ratings: RatingTriple[], nUsers: number, nItems: number,
  { lambda = 10, k = 40, minCo = 2 }: { lambda?: number; k?: number; minCo?: number } = {},
): Neighbour[][] {
  const mu = userMeans(ratings, nUsers);
  // user → list of (item, centred rating)
  const byUser: { i: number; d: number }[][] = Array.from({ length: nUsers }, () => []);
  const itemNorm = new Float64Array(nItems);
  for (const { u, i, r } of ratings) {
    const d = r - mu[u];
    byUser[u].push({ i, d });
    itemNorm[i] += d * d;
  }
  for (let i = 0; i < nItems; i++) itemNorm[i] = Math.sqrt(itemNorm[i]);

  // Accumulate co-occurrence dot products in flat typed arrays (upper triangle only).
  const N = nItems;
  const dot = new Float64Array(N * N);
  const co = new Uint16Array(N * N);
  for (const list of byUser) {
    const L = list.length;
    for (let a = 0; a < L; a++) {
      const { i, d } = list[a];
      if (!d) { for (let b = a + 1; b < L; b++) { const j = list[b].i; co[i < j ? i * N + j : j * N + i]++; } continue; }
      for (let b = a + 1; b < L; b++) {
        const { i: j, d: e } = list[b];
        const idx = i < j ? i * N + j : j * N + i;
        dot[idx] += d * e;
        co[idx]++;
      }
    }
  }

  const out: Neighbour[][] = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) {
    if (!itemNorm[i]) continue;
    const row = i * N;
    for (let j = i + 1; j < N; j++) {
      const n = co[row + j];
      if (n < minCo || !itemNorm[j]) continue;
      const raw = dot[row + j] / (itemNorm[i] * itemNorm[j]);
      const s = shrink(raw, n, lambda);
      if (s <= 0) continue;
      out[i].push({ j, s, n });
      out[j].push({ j: i, s, n });
    }
  }
  for (const l of out) { l.sort((a, b) => b.s - a.s); if (l.length > k) l.length = k; }
  return out;
}

/* ───────── Text ───────── */

const STOP = new Set(["and", "the", "of", "in", "a", "an", "to", "for", "on", "with", "by", "fiction", "general", "literature", "nyt", "s", "etc", "accessible", "book", "books", "protected", "daisy", "large", "type", "reading", "level", "grade"]);

/** Light normalisation: lowercase, strip diacritics/punctuation, crude plural stemming, drop stopwords. */
export function tokenize(s: string): string[] {
  return s
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t))
    .map((t) => (t.length > 4 && t.endsWith("ies") ? t.slice(0, -3) + "y" : t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

/** TF-IDF vectors (log tf, smoothed idf) over a corpus of token lists, L2-normalised. Returns vectors and vocab. */
export function tfidf(docs: string[][]): { vecs: SparseVec[]; vocab: Map<string, number>; idf: number[] } {
  const vocab = new Map<string, number>();
  const df: number[] = [];
  const tfs = docs.map((toks) => {
    const tf = new Map<number, number>();
    for (const t of toks) {
      let id = vocab.get(t);
      if (id === undefined) { id = vocab.size; vocab.set(t, id); df.push(0); }
      tf.set(id, (tf.get(id) ?? 0) + 1);
    }
    for (const id of tf.keys()) df[id]++;
    return tf;
  });
  const D = docs.length;
  const idf = df.map((d) => Math.log((1 + D) / (1 + d)) + 1);
  const vecs = tfs.map((tf) => {
    const v: SparseVec = new Map();
    let n2 = 0;
    for (const [id, c] of tf) {
      if (df[id] < 2) continue; // hapax terms carry no similarity signal
      const w = (1 + Math.log(c)) * idf[id];
      v.set(id, w); n2 += w * w;
    }
    const n = Math.sqrt(n2) || 1;
    for (const [id, w] of v) v.set(id, w / n);
    return v;
  });
  return { vecs, vocab, idf };
}

/** Era proximity in [0,1]: 1 for same year, ~0.5 at 15 years apart. */
export function eraProximity(a: number | null, b: number | null, halfLife = 15): number {
  if (a == null || b == null) return 0;
  return 1 / (1 + Math.abs(a - b) / halfLife);
}

/* ───────── Diversification ───────── */

/**
 * Maximal Marginal Relevance: greedily pick argmax λ·rel − (1−λ)·max_{s∈S} sim(c, s).
 * `rel` should be normalised roughly to [0,1].
 */
export function mmr<T>(cands: T[], rel: (c: T) => number, sim: (a: T, b: T) => number, k: number, lambda = 0.75): T[] {
  const pool = cands.slice();
  const picked: T[] = [];
  const maxSim = new Float64Array(pool.length);
  const relv = pool.map(rel);
  const alive = new Uint8Array(pool.length).fill(1);
  while (picked.length < k && picked.length < pool.length) {
    let best = -1, bestScore = -Infinity;
    for (let c = 0; c < pool.length; c++) {
      if (!alive[c]) continue;
      const sc = lambda * relv[c] - (1 - lambda) * maxSim[c];
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    if (best < 0) break;
    alive[best] = 0;
    const chosen = pool[best];
    picked.push(chosen);
    for (let c = 0; c < pool.length; c++) if (alive[c]) maxSim[c] = Math.max(maxSim[c], sim(pool[c], chosen));
  }
  return picked;
}

/* ───────── User scoring ───────── */

export type ProfileItem = { i: number; w: number };

/**
 * Score unseen items from a weighted profile through item neighbour lists.
 * score(c) = Σ_p w_p·sim(p,c) / Σ_p |sim(p,c)|·(something) — we keep both the raw sum and the support,
 * plus the profile item contributing most (for the reason string).
 */
export function scoreFromNeighbours(profile: ProfileItem[], neighbours: Neighbour[][], seen: Set<number>) {
  const acc = new Map<number, { sum: number; supp: number; top: number; topContrib: number }>();
  for (const { i, w } of profile) {
    for (const { j, s } of neighbours[i] ?? []) {
      if (seen.has(j)) continue;
      const contrib = w * s;
      let a = acc.get(j);
      if (!a) { a = { sum: 0, supp: 0, top: -1, topContrib: -Infinity }; acc.set(j, a); }
      a.sum += contrib; a.supp += s;
      if (contrib > a.topContrib) { a.topContrib = contrib; a.top = i; }
    }
  }
  return acc;
}
