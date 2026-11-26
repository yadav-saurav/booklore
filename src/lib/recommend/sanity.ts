/**
 * Real-data sanity check for the recommender (run after seeding):
 *   npx tsx --conditions=react-server src/lib/recommend/sanity.ts
 */
import { sqlite } from "@/db";
import { loadContent, loadCF, ratingsSig } from "./model";
import { similarIds, recommendIds, becauseYouRatedIds } from "./engine";

const c = loadContent();
const t0 = performance.now();
const cf = loadCF(c);
console.log(`catalog ${c.books.length} books, ${cf.nRatings} ratings; CF rebuild ${cf.buildMs.toFixed(1)}ms (first call incl. JIT), sig ${ratingsSig()}`);
// force rebuilds for a stable timing
const times: number[] = [];
for (let k = 0; k < 5; k++) {
  (globalThis as unknown as { __blRec: { cf?: unknown } }).__blRec.cf = undefined;
  times.push(loadCF(c).buildMs);
}
console.log(`CF rebuild (warm): ${times.map((t) => t.toFixed(1)).join(", ")} ms; cached hit ${(performance.now() - t0).toFixed(0)}ms total`);
const tc = performance.now(); loadCF(c); console.log(`cache hit: ${(performance.now() - tc).toFixed(2)}ms`);

const b = (id: string) => c.books[c.index.get(id)!];
const fmt = (id: string) => `${b(id).title} [${b(id).genres.join(",")}]`;

const fantasy = (sqlite.prepare(`SELECT b.id FROM books b JOIN book_genres g ON g.book_id = b.id AND g.genre_slug = 'fantasy' ORDER BY b.rating_count DESC LIMIT 2`).all() as { id: string }[]).map((r) => r.id);
for (const id of fantasy) {
  const sim = similarIds(id, 10);
  const share = sim.filter((s) => b(s.id).genres.some((g) => ["fantasy", "science-fiction", "young-adult", "classics", "horror"].includes(g))).length;
  console.log(`\nSimilar to ${fmt(id)} (${share}/${sim.length} fantasy-adjacent):`);
  for (const s of sim) console.log(`  ${s.score.toFixed(3)}  ${fmt(s.id)}  — ${s.reason}`);
}

const unrated = sqlite.prepare(`SELECT id FROM books WHERE rating_count = 0 LIMIT 1`).get() as { id: string } | undefined;
if (unrated) {
  console.log(`\nContent-only similar to unrated ${fmt(unrated.id)}:`);
  for (const s of similarIds(unrated.id, 5)) console.log(`  ${s.score.toFixed(3)}  ${fmt(s.id)}`);
}

const demo = sqlite.prepare(`SELECT id FROM users WHERE email = 'demo@booklore.app'`).get() as { id: number } | undefined;
if (demo) {
  const rated = sqlite.prepare(`SELECT book_id, score FROM ratings WHERE user_id = ? ORDER BY score DESC`).all(demo.id) as { book_id: string; score: number }[];
  console.log(`\nDemo rated: ${rated.map((r) => `${b(r.book_id).title} ${r.score}`).join("; ")}`);
  const tr = performance.now();
  const recs = recommendIds(demo.id, 24);
  console.log(`Demo top picks (${(performance.now() - tr).toFixed(1)}ms):`);
  const seen = new Set((sqlite.prepare(`SELECT book_id FROM shelf WHERE user_id = ? UNION SELECT book_id FROM ratings WHERE user_id = ?`).all(demo.id, demo.id) as { book_id: string }[]).map((r) => r.book_id));
  for (const r of recs) console.log(`  ${r.score.toFixed(3)}  ${fmt(r.id)}  — ${r.reason}${seen.has(r.id) ? "  !!SEEN" : ""}`);
  const g = new Map<string, number>(); recs.forEach((r) => b(r.id).genres.forEach((x) => g.set(x, (g.get(x) ?? 0) + 1)));
  console.log(`  genre mix: ${[...g].sort((a, z) => z[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  for (const rail of becauseYouRatedIds(demo.id, 2, 6)) console.log(`\nBecause you rated ${b(rail.seed).title} ${rail.score}/10: ${rail.items.map((x) => b(x.id).title).join(" | ")}`);
}
console.log(`\nAnonymous cold start: ${recommendIds(null, 12).map((r) => `${b(r.id).title} (${r.reason})`).join(" | ")}`);
