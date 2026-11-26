import { describe, it, expect } from "vitest";
import { itemItemCF, shrink, sparseCosine, jaccard, mmr, tokenize, tfidf, scoreFromNeighbours, eraProximity, userMeans } from "./math";

describe("vector math", () => {
  it("sparse cosine", () => {
    const a = new Map([[0, 1], [1, 1]]);
    const b = new Map([[0, 1]]);
    expect(sparseCosine(a, b)).toBeCloseTo(1 / Math.SQRT2, 6);
    expect(sparseCosine(a, a)).toBeCloseTo(1, 6);
    expect(sparseCosine(a, new Map([[5, 2]]))).toBe(0);
    expect(sparseCosine(a, new Map())).toBe(0);
  });
  it("jaccard", () => {
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(1 / 3);
    expect(jaccard([], ["x"])).toBe(0);
  });
  it("shrinkage pulls low-support similarities towards zero", () => {
    expect(shrink(0.9, 2, 10)).toBeCloseTo(0.15);
    expect(shrink(0.9, 100, 10)).toBeGreaterThan(0.8);
    expect(shrink(0.5, 30, 10)).toBeLessThan(0.5);
  });
  it("era proximity decays with distance", () => {
    expect(eraProximity(1990, 1990)).toBe(1);
    expect(eraProximity(1990, 2005)).toBeCloseTo(0.5);
    expect(eraProximity(null, 2000)).toBe(0);
  });
});

describe("item–item CF (adjusted cosine)", () => {
  // Items 0,1 are loved together; item 2 is loved by those who dislike 0,1.
  const R = [
    [9, 9, 2], [8, 9, 3], [9, 8, 2], [2, 3, 9], [3, 2, 8],
  ];
  const triples = R.flatMap((row, u) => row.map((r, i) => ({ u, i, r })));

  it("centres by user mean", () => {
    const mu = userMeans(triples, 5);
    expect(mu[0]).toBeCloseTo(20 / 3);
  });
  it("finds positively correlated items and drops anti-correlated ones", () => {
    const nb = itemItemCF(triples, 5, 3, { lambda: 0, k: 5, minCo: 1 });
    expect(nb[0].map((x) => x.j)).toEqual([1]);
    expect(nb[0][0].s).toBeGreaterThan(0.5);
    expect(nb[2]).toEqual([]); // only negative similarities → none kept
    expect(nb[0][0].n).toBe(5);
  });
  it("shrinkage lowers similarity and respects minCo", () => {
    const raw = itemItemCF(triples, 5, 3, { lambda: 0, minCo: 1 })[0][0].s;
    const shr = itemItemCF(triples, 5, 3, { lambda: 10, minCo: 1 })[0][0].s;
    expect(shr).toBeCloseTo(raw * 5 / 15, 6);
    expect(itemItemCF(triples, 5, 3, { minCo: 6 })[0]).toEqual([]);
  });
  it("keeps only top-K neighbours, strongest first", () => {
    // item 0 co-varies with items 1..4 with decreasing fidelity
    const t: { u: number; i: number; r: number }[] = [];
    for (let u = 0; u < 8; u++) {
      const like = u % 2 ? 9 : 3;
      t.push({ u, i: 0, r: like }, { u, i: 5, r: 12 - like }); // item 5 gives every user variance
      for (let i = 1; i <= 4; i++) t.push({ u, i, r: u < i - 1 ? 6 : like }); // item i disagrees on i−1 users
    }
    const nb = itemItemCF(t, 8, 6, { lambda: 0, k: 2, minCo: 1 });
    for (const l of nb) expect(l.length).toBeLessThanOrEqual(2);
    expect(nb[0].map((x) => x.j)).toEqual([1, 2]);
    expect(itemItemCF(t, 8, 6, { lambda: 0, k: 10, minCo: 1 })[0].length).toBeGreaterThan(2);
    expect(nb[0][0].s).toBeGreaterThanOrEqual(nb[0][1].s);
  });
  it("rebuilds 400 items × 4k ratings well under 150ms", () => {
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const t: { u: number; i: number; r: number }[] = [];
    const seen = new Set<string>();
    while (t.length < 4000) {
      const u = Math.floor(rnd() * 70), i = Math.floor(rnd() * 400);
      if (seen.has(`${u}:${i}`)) continue; seen.add(`${u}:${i}`);
      t.push({ u, i, r: 1 + Math.floor(rnd() * 10) });
    }
    itemItemCF(t, 70, 400); // warm up JIT
    const t0 = performance.now();
    itemItemCF(t, 70, 400, { lambda: 12, k: 50, minCo: 3 });
    const ms = performance.now() - t0;
    console.log(`itemItemCF 400×4000: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(150);
  });
});

describe("profile scoring", () => {
  it("excludes seen items and records the strongest contributor", () => {
    const nb = [[{ j: 1, s: 0.8, n: 5 }, { j: 2, s: 0.4, n: 5 }], [{ j: 0, s: 0.8, n: 5 }], [{ j: 0, s: 0.4, n: 5 }, { j: 3, s: 0.9, n: 5 }], []];
    const acc = scoreFromNeighbours([{ i: 0, w: 1 }, { i: 2, w: 0.5 }], nb, new Set([0, 2]));
    expect([...acc.keys()].sort()).toEqual([1, 3]);
    expect(acc.has(0)).toBe(false);
    expect(acc.get(3)!.top).toBe(2);
    expect(acc.get(1)!.sum).toBeCloseTo(0.8);
  });
});

describe("MMR", () => {
  type C = { id: string; g: string; rel: number };
  const cands: C[] = [
    { id: "a1", g: "fantasy", rel: 1 }, { id: "a2", g: "fantasy", rel: 0.98 }, { id: "a3", g: "fantasy", rel: 0.96 },
    { id: "b1", g: "mystery", rel: 0.8 }, { id: "c1", g: "history", rel: 0.7 },
  ];
  const sim = (a: C, b: C) => (a.g === b.g ? 1 : 0);
  it("λ=1 is pure relevance ranking", () => {
    expect(mmr(cands, (c) => c.rel, sim, 3, 1).map((c) => c.id)).toEqual(["a1", "a2", "a3"]);
  });
  it("λ=0.75 diversifies across genres", () => {
    const ids = mmr(cands, (c) => c.rel, sim, 3, 0.75).map((c) => c.id);
    expect(ids[0]).toBe("a1");
    expect(new Set(ids.map((id) => id[0])).size).toBe(3);
  });
  it("never returns duplicates or more than k", () => {
    const ids = mmr(cands, (c) => c.rel, sim, 10).map((c) => c.id);
    expect(ids.length).toBe(5);
    expect(new Set(ids).size).toBe(5);
  });
});

describe("text", () => {
  it("tokenises and lightly stems", () => {
    expect(tokenize("Dragons, Magic & Épic Fantasy fiction")).toEqual(["dragon", "magic", "epic", "fantasy"]);
    expect(tokenize("Mysteries")).toEqual(["mystery"]);
  });
  it("tf-idf makes shared rare terms dominate", () => {
    const { vecs } = tfidf([["dragon", "magic", "war"], ["dragon", "magic"], ["war", "detective"], ["detective", "murder"], ["war"]]);
    expect(sparseCosine(vecs[0], vecs[1])).toBeGreaterThan(sparseCosine(vecs[0], vecs[2]));
    expect(sparseCosine(vecs[1], vecs[3])).toBe(0);
  });
});
