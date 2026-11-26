/**
 * Seeds the BOOKLORE database from data/seed/*.json.
 *   npm run db:seed            (wipes data/booklore.db and rebuilds)
 *
 * Catalog (books/authors) comes from Open Library metadata snapshots with original synopses/bios.
 * Community data (users, ratings, reviews, shelves, lists, views) is simulated with a seeded PRNG so
 * charts, BookMeter and collaborative-filtering recommendations have realistic structure:
 *   score = bookQuality + userHarshness + genreAffinity + noise
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, "data", "booklore.db");
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (fs.existsSync(f)) fs.unlinkSync(f);

const { sqlite, reindexBook } = await import("../src/db/index");
const { recomputeRankings } = await import("../src/lib/aggregates");
const crypto = await import("node:crypto");

const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, "data/seed", f), "utf8")) as T;

type SeedBook = {
  id: string; olWorkKey: string; title: string; subtitle: string | null; authorKeys: string[]; firstPublishYear: number | null;
  coverId: number | null; isbn13: string | null; pages: number | null; publisher: string | null; language: string | null;
  subjects: string[]; genres: string[]; synopsis: string; olRatingAvg: number | null; olRatingCount: number;
  olWantToRead: number; olAlreadyRead?: number;
};
type SeedAuthor = { id: string; olKey: string; name: string; birthDate: string | null; deathDate: string | null; photoId: number | null; bio: string; nationality: string | null };
type Rev = { headline: string; body: string };
type Community = {
  users: { username: string; displayName: string; bio: string; location: string; favoriteGenres: string[]; harshness: number }[];
  reviews: Record<string, { high: Rev[]; mid: Rev[]; low: Rev[] }>;
  lists: { owner: string; title: string; description: string; featured: boolean; books: string[] }[];
};

/* ───────── deterministic PRNG ───────── */
let seed = 20261126;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const gauss = () => { const u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;
/** timestamps skewed toward the recent past */
const pastTs = (maxDays = 720) => NOW - Math.floor(Math.pow(rand(), 1.8) * maxDays * DAY) - randInt(0, DAY);

/* ───────── genres ───────── */
const GENRES: [string, string, string, string][] = [
  ["literary-fiction", "Literary Fiction", "文学", "Character-driven novels where the sentences matter as much as the story."],
  ["classics", "Classics", "古典", "Books that outlived their century and still start arguments."],
  ["fantasy", "Fantasy", "幻想", "Secondary worlds, old magic and long roads."],
  ["science-fiction", "Science Fiction", "空想科学", "Futures, far planets and the ideas that shape them."],
  ["mystery", "Mystery", "推理", "Puzzles, detectives and the satisfying click of a solution."],
  ["thriller", "Thriller", "スリラー", "High stakes, short chapters, late nights."],
  ["horror", "Horror", "恐怖", "Dread, the uncanny and things in the dark."],
  ["romance", "Romance", "恋愛", "Love stories with every kind of ending worth waiting for."],
  ["historical-fiction", "Historical Fiction", "歴史小説", "The past, reimagined through the people who lived it."],
  ["young-adult", "Young Adult", "青春", "Coming-of-age stories with real teeth."],
  ["childrens", "Children's", "児童", "Picture books and middle-grade favourites for every age."],
  ["graphic-novels", "Graphic Novels", "漫画", "Comics, manga and stories told in panels."],
  ["poetry", "Poetry", "詩", "Collections and long poems, old and new."],
  ["biography-memoir", "Biography & Memoir", "伝記", "Real lives, told by the people who lived them or studied them."],
  ["history", "History", "歴史", "Narrative and popular history of every era."],
  ["science", "Science", "科学", "Accessible books on how the universe, life and minds work."],
  ["philosophy", "Philosophy", "哲学", "Big questions, from the Stoics to the present."],
  ["psychology", "Psychology", "心理", "Why we think, decide and behave the way we do."],
  ["self-help", "Self-Help", "自己啓発", "Practical books for habits, focus and a better life."],
  ["business", "Business", "経営", "Strategy, leadership, money and how companies work."],
  ["true-crime", "True Crime", "実録犯罪", "Real cases, investigations and their aftermath."],
  ["travel", "Travel", "旅", "Journeys, places and the people met along the way."],
  ["humor", "Humor", "諧謔", "Books that are actually funny."],
];

const insGenre = sqlite.prepare(`INSERT INTO genres (slug, name, kanji, description, position) VALUES (?,?,?,?,?)`);
GENRES.forEach(([slug, name, kanji, desc], i) => insGenre.run(slug, name, kanji, desc, i));

/* ───────── catalog ───────── */
const books = read<SeedBook[]>("books.json");
const authors = read<SeedAuthor[]>("authors.json");
const authorByKey = new Map(authors.map((a) => [a.olKey, a]));

sqlite.transaction(() => {
  const insA = sqlite.prepare(`INSERT INTO authors (id, ol_key, name, birth_date, death_date, photo_id, bio, nationality, source) VALUES (?,?,?,?,?,?,?,?, 'seed')`);
  for (const a of authors) insA.run(a.id, a.olKey, a.name, a.birthDate, a.deathDate, a.photoId, a.bio, a.nationality);
  const insB = sqlite.prepare(`INSERT INTO books (id, ol_work_key, title, subtitle, first_publish_year, cover_id, isbn13, pages, publisher, language,
      synopsis, subjects, source, ol_rating_avg, ol_rating_count, ol_want_to_read) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'seed', ?,?,?)`);
  const insBA = sqlite.prepare(`INSERT OR IGNORE INTO book_authors (book_id, author_id, position) VALUES (?,?,?)`);
  const insBG = sqlite.prepare(`INSERT OR IGNORE INTO book_genres (book_id, genre_slug) VALUES (?,?)`);
  for (const b of books) {
    insB.run(b.id, b.olWorkKey, b.title, b.subtitle, b.firstPublishYear, b.coverId, b.isbn13, b.pages, b.publisher, b.language,
      b.synopsis, JSON.stringify(b.subjects ?? []), b.olRatingAvg, b.olRatingCount ?? 0, b.olWantToRead ?? 0);
    b.authorKeys.forEach((k, i) => { const a = authorByKey.get(k); if (a) insBA.run(b.id, a.id, i); });
    for (const g of b.genres) insBG.run(b.id, g);
  }
})();
for (const b of books) reindexBook(b.id);
console.log(`catalog: ${books.length} books, ${authors.length} authors`);

/* ───────── users ───────── */
const community = read<Community>("community.json");
const hash = (pw: string) => { const salt = crypto.randomBytes(16).toString("hex"); return ["scrypt", salt, crypto.scryptSync(pw, salt, 64).toString("hex")].join(":"); };
const mockHash = hash("booklore-sample-" + crypto.randomBytes(8).toString("hex")); // sample members cannot sign in
const insU = sqlite.prepare(`INSERT INTO users (username, display_name, email, password_hash, bio, location, avatar_hue, is_mock, created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
type U = { id: number; fav: Set<string>; harsh: number; activity: number };
const users: U[] = [];
for (const u of community.users) {
  const r = insU.run(u.username, u.displayName, null, mockHash, u.bio, u.location, randInt(0, 359), 1, pastTs(1400));
  users.push({ id: Number(r.lastInsertRowid), fav: new Set(u.favoriteGenres), harsh: clamp(u.harshness ?? 0, -1.5, 1.5), activity: 0.4 + rand() * 1.6 });
}
// Demo account so the personalised features can be tried immediately.
const demoId = Number(insU.run("demo", "Demo Reader", "demo@booklore.app", hash("booklore123"), "Trying out BOOKLORE.", "Lisbon, Portugal", 214, 0, NOW - 90 * DAY).lastInsertRowid);
console.log(`users: ${users.length} sample + demo (demo@booklore.app / booklore123)`);

/* ───────── ratings / reviews / shelves ───────── */
const bookMeta = books.map((b) => {
  const prior = b.olRatingAvg ? b.olRatingAvg * 2 : 7.2 + gauss() * 0.5;
  const quality = clamp(prior + gauss() * 0.35, 5.2, 9.3);
  const pop = Math.log(2 + (b.olWantToRead ?? 0) + (b.olRatingCount ?? 0) * 3);
  return { id: b.id, title: b.title, genres: b.genres, quality, pop, year: b.firstPublishYear ?? 2000 };
});
const maxPop = Math.max(...bookMeta.map((b) => b.pop));

const insR = sqlite.prepare(`INSERT OR IGNORE INTO ratings (user_id, book_id, score, created_at, updated_at) VALUES (?,?,?,?,?)`);
const insRev = sqlite.prepare(`INSERT OR IGNORE INTO reviews (user_id, book_id, headline, body, spoiler, helpful_count, unhelpful_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
const insS = sqlite.prepare(`INSERT OR REPLACE INTO shelf (user_id, book_id, status, progress, added_at, updated_at) VALUES (?,?,?,?,?,?)`);
const thisYear = new Date().getFullYear();

let nR = 0, nRev = 0;
sqlite.transaction(() => {
  for (const u of users) {
    const weights = bookMeta.map((b) => {
      let w = Math.pow(b.pop / maxPop, 2.2);
      if (b.genres.some((g) => u.fav.has(g))) w *= 3.2;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    const target = Math.round((20 + rand() * 60) * u.activity);
    const chosen = new Set<number>();
    for (let guard = 0; chosen.size < Math.min(target, bookMeta.length - 5) && guard < 5000; guard++) {
      let x = rand() * total, i = 0;
      while ((x -= weights[i]) > 0 && i < weights.length - 1) i++;
      chosen.add(i);
    }
    for (const i of chosen) {
      const b = bookMeta[i];
      const affinity = b.genres.some((g) => u.fav.has(g)) ? 0.6 : -0.3;
      const score = clamp(Math.round(b.quality + u.harsh + affinity + gauss() * 1.05), 1, 10);
      // newer books are rated more recently
      const ts = b.year >= thisYear - 1 ? NOW - randInt(0, 120) * DAY : pastTs();
      insR.run(u.id, b.id, score, ts, ts);
      insS.run(u.id, b.id, "read", null, ts, ts);
      nR++;
      if (rand() < 0.22) {
        const corpus = community.reviews[b.genres[0]] ?? community.reviews[Object.keys(community.reviews)[0]];
        const band = score >= 8 ? corpus.high : score >= 5 ? corpus.mid : corpus.low;
        if (band?.length) {
          const rv = pick(band);
          const helpful = Math.floor(Math.pow(rand(), 2.5) * 180 * (b.pop / maxPop));
          insRev.run(u.id, b.id, rv.headline, rv.body.replaceAll("{title}", b.title), rand() < 0.06 ? 1 : 0, helpful, Math.floor(helpful * rand() * 0.25), ts + randInt(0, 3) * DAY, ts);
          nRev++;
        }
      }
    }
    // want-to-read and currently-reading shelves
    const wantN = randInt(4, 26);
    for (let k = 0; k < wantN; k++) {
      const b = bookMeta[Math.floor(rand() * bookMeta.length)];
      if (sqlite.prepare(`SELECT 1 FROM shelf WHERE user_id = ? AND book_id = ?`).get(u.id, b.id)) continue;
      const ts = b.year >= thisYear - 1 ? NOW - randInt(0, 21) * DAY : pastTs(365);
      insS.run(u.id, b.id, k < 2 ? "reading" : "want", k < 2 ? randInt(20, 300) : null, ts, ts);
    }
  }
})();
console.log(`ratings: ${nR}, reviews: ${nRev}`);

/* demo user: a sci-fi / fantasy leaning profile */
sqlite.transaction(() => {
  const demoPicks = bookMeta.filter((b) => b.genres.some((g) => ["science-fiction", "fantasy"].includes(g))).sort((a, b) => b.pop - a.pop).slice(0, 10);
  for (const b of demoPicks) { const s = clamp(Math.round(b.quality + gauss() * 0.8), 5, 10); insR.run(demoId, b.id, s, NOW - randInt(1, 80) * DAY, NOW); insS.run(demoId, b.id, "read", null, NOW, NOW); }
  const wants = bookMeta.filter((b) => b.genres.includes("mystery")).slice(0, 4);
  for (const b of wants) insS.run(demoId, b.id, "want", null, NOW - randInt(1, 20) * DAY, NOW);
})();

/* ───────── lists ───────── */
const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
const byTitle = new Map(books.map((b) => [norm(b.title), b.id]));
const userIdByName = new Map(community.users.map((u, i) => [u.username, users[i].id]));
const insL = sqlite.prepare(`INSERT INTO lists (user_id, title, description, is_public, is_featured, like_count, created_at, updated_at) VALUES (?,?,?,1,?,?,?,?)`);
const insLI = sqlite.prepare(`INSERT OR IGNORE INTO list_items (list_id, book_id, position) VALUES (?,?,?)`);
const insLL = sqlite.prepare(`INSERT OR IGNORE INTO list_likes (list_id, user_id) VALUES (?,?)`);
let nL = 0;
sqlite.transaction(() => {
  for (const l of community.lists) {
    const ids = l.books.map((t) => byTitle.get(norm(t))).filter(Boolean) as string[];
    if (ids.length < 4) continue;
    const ts = pastTs(400);
    const listId = Number(insL.run(userIdByName.get(l.owner) ?? users[0].id, l.title, l.description, l.featured ? 1 : 0, 0, ts, ts).lastInsertRowid);
    [...new Set(ids)].forEach((id, i) => insLI.run(listId, id, i));
    const likes = randInt(l.featured ? 25 : 2, l.featured ? 60 : 30);
    for (let k = 0; k < likes; k++) insLL.run(listId, pick(users).id);
    sqlite.prepare(`UPDATE lists SET like_count = (SELECT count(*) FROM list_likes WHERE list_id = ?) WHERE id = ?`).run(listId, listId);
    nL++;
  }
})();
console.log(`lists: ${nL}`);

/* ───────── follows ───────── */
sqlite.transaction(() => {
  const ins = sqlite.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`);
  for (const u of users) for (let k = randInt(0, 12); k > 0; k--) { const v = pick(users); if (v.id !== u.id) ins.run(u.id, v.id, pastTs(400)); }
})();

/* ───────── page views → BookMeter ───────── */
const insV = sqlite.prepare(`INSERT INTO book_views (book_id, day, count) VALUES (?, date('now', ?), ?) ON CONFLICT(book_id, day) DO UPDATE SET count = count + excluded.count`);
const trending = new Set(bookMeta.filter(() => rand() < 0.08).map((b) => b.id));
sqlite.transaction(() => {
  for (const b of bookMeta) {
    const recent = b.year >= thisYear - 2 ? 2.4 : 1;
    for (let d = 0; d < 14; d++) {
      let v = (b.pop / maxPop) * 60 * recent * (0.6 + rand() * 0.8);
      if (trending.has(b.id) && d < 4) v *= 3 + rand() * 3; // a few breakout titles this week
      insV.run(b.id, `-${d} days`, Math.round(v));
    }
  }
})();

/* Rankings: compute "last week", then "this week", so BookMeter has movement arrows. */
sqlite.exec(`UPDATE book_views SET day = date(day, '-100 days')`);
recomputeRankings();
sqlite.exec(`UPDATE book_views SET day = date(day, '+100 days')`);
recomputeRankings();

const top = sqlite.prepare(`SELECT title, round(weighted_score,2) w, rating_count n FROM books ORDER BY weighted_score DESC LIMIT 5`).all();
const pop = sqlite.prepare(`SELECT title, popularity_rank r, prev_popularity_rank p FROM books ORDER BY popularity_rank LIMIT 5`).all();
console.log("top weighted:", top);
console.log("bookmeter:", pop);
sqlite.close();
