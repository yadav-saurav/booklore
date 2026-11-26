/**
 * Seeds the BOOKLORE database (Postgres via DATABASE_URL, or embedded PGlite when unset).
 *   npm run db:seed              wipe all data and rebuild
 *   npm run db:seed -- --if-empty  only seed when the catalog is empty (safe for build/deploy hooks)
 *
 * Catalog (books/authors) comes from Open Library metadata snapshots with original synopses/bios.
 * Community data (users, ratings, reviews, shelves, lists, views) is simulated with a seeded PRNG so
 * charts, BookMeter and collaborative-filtering recommendations have realistic structure:
 *   score = bookQuality + userHarshness + genreAffinity + noise
 * Everything is generated in memory, then bulk-inserted, so seeding a remote database takes seconds.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, reindexBook, closeDb, type Db } from "../src/db/index";
import { recomputeRankings } from "../src/lib/aggregates";

const ROOT = process.cwd();
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, "data/seed", f), "utf8")) as T;
const ifEmpty = process.argv.includes("--if-empty");

type SeedBook = {
  id: string; olWorkKey: string; title: string; subtitle: string | null; authorKeys: string[]; firstPublishYear: number | null;
  coverId: number | null; isbn13: string | null; pages: number | null; publisher: string | null; language: string | null;
  subjects: string[]; genres: string[]; synopsis: string; olRatingAvg: number | null; olRatingCount: number;
  olWantToRead: number;
};
type SeedAuthor = { id: string; olKey: string; name: string; birthDate: string | null; deathDate: string | null; photoId: number | null; bio: string; nationality: string | null };
type Rev = { headline: string; body: string };
type Community = {
  users: { username: string; displayName: string; bio: string; location: string; favoriteGenres: string[]; harshness: number }[];
  reviews: Record<string, { high: Rev[]; mid: Rev[]; low: Rev[] }>;
  lists: { owner: string; title: string; description: string; featured: boolean; books: string[] }[];
};

/** Multi-row INSERT in chunks (keeps each statement well under Postgres' 65k parameter limit). */
async function bulk(t: Db, table: string, cols: string[], rows: unknown[][], suffix = "") {
  const per = Math.max(1, Math.floor(30000 / cols.length));
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    const ph = chunk.map(() => `(${cols.map(() => "?").join(",")})`).join(",");
    await t.run(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${ph} ${suffix}`, ...chunk.flat());
  }
}

/* ───────── deterministic PRNG ───────── */
let seed = 20261126;
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const randInt = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const gauss = () => { const u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;
const pastTs = (maxDays = 720) => NOW - Math.floor(Math.pow(rand(), 1.8) * maxDays * DAY) - randInt(0, DAY);
const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY * 1000).toISOString().slice(0, 10);

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

async function main() {
  const t0 = Date.now();
  const existing = await db.get<{ n: number }>(`SELECT count(*) n FROM books`);
  if (ifEmpty && existing && existing.n > 0) {
    console.log(`seed: catalog already has ${existing.n} books, skipping (--if-empty)`);
    return;
  }

  /* ───────── catalog ───────── */
  const books = read<SeedBook[]>("books.json");
  const authors = read<SeedAuthor[]>("authors.json");
  const authorByKey = new Map(authors.map((a) => [a.olKey, a]));
  // Open Library lists languages/publishers across all editions in arbitrary order; prefer English
  // (and a recognisable English-language publisher) when an English edition exists.
  try {
    const editions = read<Record<string, { language: string[]; publisher: string[] }>>("editions.json");
    const known = /\b(Books|Press|Penguin|Random House|Harper|Vintage|Ace|Tor|Bantam|Scribner|Knopf|Doubleday|Macmillan|Simon|Little, Brown|Faber|Bloomsbury|Puffin|Scholastic|Houghton|Viking|Anchor|Del Rey|Orbit|Gollancz|Picador|Riverhead|Crown|Signet|Dover|Norton|Grand Central|Ballantine)\b/;
    for (const b of books) {
      const r = editions[b.olWorkKey];
      if (!r?.language?.includes("eng")) continue;
      b.language = "en";
      const p = r.publisher?.find((x) => known.test(x)) ?? r.publisher?.find((x) => /^[\x20-\x7E]{4,}$/.test(x) && !/^\d/.test(x));
      if (p) b.publisher = p;
    }
  } catch { /* editions snapshot optional */ }

  const community = read<Community>("community.json");
  const hash = (pw: string) => { const salt = crypto.randomBytes(16).toString("hex"); return ["scrypt", salt, crypto.scryptSync(pw, salt, 64).toString("hex")].join(":"); };
  const mockHash = hash("booklore-sample-" + crypto.randomBytes(8).toString("hex")); // sample members cannot sign in

  /* ───────── simulate community (in memory) ───────── */
  type U = { id: number; fav: Set<string>; harsh: number; activity: number };
  const users: U[] = community.users.map((u, i) => ({ id: i + 1, fav: new Set(u.favoriteGenres), harsh: clamp(u.harshness ?? 0, -1.5, 1.5), activity: 0.4 + rand() * 1.6 }));
  const userRows = community.users.map((u, i) => [i + 1, u.username, u.displayName, null, mockHash, u.bio, u.location, randInt(0, 359), 1, pastTs(1400)]);
  const demoId = users.length + 1;
  userRows.push([demoId, "demo", "Demo Reader", "demo@booklore.app", hash("booklore123"), "Trying out BOOKLORE.", "Lisbon, Portugal", 214, 0, NOW - 90 * DAY]);

  const bookMeta = books.map((b) => {
    const prior = b.olRatingAvg ? b.olRatingAvg * 2 : 7.2 + gauss() * 0.5;
    return { id: b.id, title: b.title, genres: b.genres, quality: clamp(prior + gauss() * 0.35, 5.2, 9.3), pop: Math.log(2 + (b.olWantToRead ?? 0) + (b.olRatingCount ?? 0) * 3), year: b.firstPublishYear ?? 2000 };
  });
  const maxPop = Math.max(...bookMeta.map((b) => b.pop));
  const thisYear = new Date().getFullYear();

  const ratings = new Map<string, unknown[]>(); // key user:book
  const shelf = new Map<string, unknown[]>();
  const reviews: unknown[][] = [];
  const used = new Map<Rev, number>();

  for (const u of users) {
    const weights = bookMeta.map((b) => Math.pow(b.pop / maxPop, 2.2) * (b.genres.some((g) => u.fav.has(g)) ? 3.2 : 1));
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
      const ts = b.year >= thisYear - 1 ? NOW - randInt(0, 120) * DAY : pastTs();
      ratings.set(`${u.id}:${b.id}`, [u.id, b.id, score, ts, ts]);
      shelf.set(`${u.id}:${b.id}`, [u.id, b.id, "read", null, ts, ts]);
      if (rand() < 0.22) {
        const corpus = community.reviews[b.genres[0]] ?? community.reviews[Object.keys(community.reviews)[0]];
        const band = score >= 8 ? corpus.high : score >= 5 ? corpus.mid : corpus.low;
        if (band?.length) {
          // Rotate through the corpus (least-used first) so repeated texts are spread thin.
          const rv = [...band].sort((x, y) => (used.get(x) ?? 0) - (used.get(y) ?? 0) || rand() - 0.5)[0];
          used.set(rv, (used.get(rv) ?? 0) + 1);
          const helpful = Math.floor(Math.pow(rand(), 2.5) * 180 * (b.pop / maxPop));
          reviews.push([u.id, b.id, rv.headline.replaceAll("{title}", b.title), rv.body.replaceAll("{title}", b.title),
            rand() < 0.06 ? 1 : 0, helpful, Math.floor(helpful * rand() * 0.25), ts + randInt(0, 3) * DAY, ts]);
        }
      }
    }
    for (let k = 0, wantN = randInt(4, 26); k < wantN; k++) {
      const b = bookMeta[Math.floor(rand() * bookMeta.length)];
      if (shelf.has(`${u.id}:${b.id}`)) continue;
      const ts = b.year >= thisYear - 1 ? NOW - randInt(0, 21) * DAY : pastTs(365);
      shelf.set(`${u.id}:${b.id}`, [u.id, b.id, k < 2 ? "reading" : "want", k < 2 ? randInt(20, 300) : null, ts, ts]);
    }
  }
  // Demo account: a sci-fi / fantasy leaning profile so personalised features are visible immediately.
  for (const b of bookMeta.filter((b) => b.genres.some((g) => ["science-fiction", "fantasy"].includes(g))).sort((a, b) => b.pop - a.pop).slice(0, 10)) {
    ratings.set(`${demoId}:${b.id}`, [demoId, b.id, clamp(Math.round(b.quality + gauss() * 0.8), 5, 10), NOW - randInt(1, 80) * DAY, NOW]);
    shelf.set(`${demoId}:${b.id}`, [demoId, b.id, "read", null, NOW, NOW]);
  }
  for (const b of bookMeta.filter((b) => b.genres.includes("mystery")).slice(0, 4))
    if (!shelf.has(`${demoId}:${b.id}`)) shelf.set(`${demoId}:${b.id}`, [demoId, b.id, "want", null, NOW - randInt(1, 20) * DAY, NOW]);

  // Lists
  const norm = (s: string) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
  const byTitle = new Map(books.map((b) => [norm(b.title), b.id]));
  const userIdByName = new Map(community.users.map((u, i) => [u.username, i + 1]));
  const listRows: unknown[][] = [], itemRows: unknown[][] = [], likeRows = new Map<string, unknown[]>();
  for (const l of community.lists) {
    const ids = [...new Set(l.books.map((t) => byTitle.get(norm(t))).filter(Boolean) as string[])];
    if (ids.length < 4) continue;
    const listId = listRows.length + 1;
    const ts = pastTs(400);
    const likes = randInt(l.featured ? 25 : 2, l.featured ? 60 : 30);
    for (let k = 0; k < likes; k++) { const uid = pick(users).id; likeRows.set(`${listId}:${uid}`, [listId, uid]); }
    listRows.push([listId, userIdByName.get(l.owner) ?? 1, l.title, l.description, 1, l.featured ? 1 : 0, 0, ts, ts]);
    ids.forEach((id, i) => itemRows.push([listId, id, i]));
  }
  const followRows = new Map<string, unknown[]>();
  for (const u of users) for (let k = randInt(0, 12); k > 0; k--) { const v = pick(users); if (v.id !== u.id) followRows.set(`${u.id}:${v.id}`, [u.id, v.id, pastTs(400)]); }

  // Page views for BookMeter: 14 days, with a few breakout titles this week.
  const trending = new Set(bookMeta.filter(() => rand() < 0.08).map((b) => b.id));
  const viewRows: unknown[][] = [];
  for (const b of bookMeta) {
    const recent = b.year >= thisYear - 2 ? 2.4 : 1;
    for (let d = 0; d < 14; d++) {
      let v = (b.pop / maxPop) * 60 * recent * (0.6 + rand() * 0.8);
      if (trending.has(b.id) && d < 4) v *= 3 + rand() * 3;
      viewRows.push([b.id, isoDay(d), Math.round(v)]);
    }
  }

  /* ───────── write ───────── */
  await db.tx(async (t) => {
    await t.exec(`TRUNCATE books_search, book_views, list_likes, list_items, lists, review_reports, review_votes, reviews, shelf, ratings,
      follows, sessions, users, book_genres, book_authors, books, genres, authors, api_cache RESTART IDENTITY CASCADE`);
    await bulk(t, "genres", ["slug", "name", "kanji", "description", "position"], GENRES.map(([s, n, k, d], i) => [s, n, k, d, i]));
    await bulk(t, "authors", ["id", "ol_key", "name", "birth_date", "death_date", "photo_id", "bio", "nationality", "source"],
      authors.map((a) => [a.id, a.olKey, a.name, a.birthDate, a.deathDate, a.photoId, a.bio, a.nationality, "seed"]));
    await bulk(t, "books", ["id", "ol_work_key", "title", "subtitle", "first_publish_year", "cover_id", "isbn13", "pages", "publisher", "language",
      "synopsis", "subjects", "source", "ol_rating_avg", "ol_rating_count", "ol_want_to_read"],
      books.map((b) => [b.id, b.olWorkKey, b.title, b.subtitle, b.firstPublishYear, b.coverId, b.isbn13, b.pages, b.publisher, b.language,
        b.synopsis, JSON.stringify(b.subjects ?? []), "seed", b.olRatingAvg, b.olRatingCount ?? 0, b.olWantToRead ?? 0]));
    await bulk(t, "book_authors", ["book_id", "author_id", "position"],
      books.flatMap((b) => b.authorKeys.map((k, i) => [b.id, authorByKey.get(k)?.id, i]).filter((r) => r[1])), "ON CONFLICT DO NOTHING");
    await bulk(t, "book_genres", ["book_id", "genre_slug"], books.flatMap((b) => b.genres.map((g) => [b.id, g])), "ON CONFLICT DO NOTHING");
    await bulk(t, "users", ["id", "username", "display_name", "email", "password_hash", "bio", "location", "avatar_hue", "is_mock", "created_at"], userRows);
    await t.exec(`SELECT setval(pg_get_serial_sequence('users','id'), (SELECT max(id) FROM users))`);
    await bulk(t, "ratings", ["user_id", "book_id", "score", "created_at", "updated_at"], [...ratings.values()]);
    await bulk(t, "shelf", ["user_id", "book_id", "status", "progress", "added_at", "updated_at"], [...shelf.values()]);
    await bulk(t, "reviews", ["user_id", "book_id", "headline", "body", "spoiler", "helpful_count", "unhelpful_count", "created_at", "updated_at"], reviews, "ON CONFLICT DO NOTHING");
    await bulk(t, "lists", ["id", "user_id", "title", "description", "is_public", "is_featured", "like_count", "created_at", "updated_at"], listRows);
    await t.exec(`SELECT setval(pg_get_serial_sequence('lists','id'), greatest(1, (SELECT max(id) FROM lists)))`);
    await bulk(t, "list_items", ["list_id", "book_id", "position"], itemRows);
    await bulk(t, "list_likes", ["list_id", "user_id"], [...likeRows.values()]);
    await t.exec(`UPDATE lists SET like_count = (SELECT count(*) FROM list_likes WHERE list_id = lists.id)`);
    await bulk(t, "follows", ["follower_id", "followee_id", "created_at"], [...followRows.values()]);
    await bulk(t, "book_views", ["book_id", "day", "count"], viewRows);
    for (const b of books) await reindexBook(b.id, t);
  });

  // Rankings: compute "last week" (views shifted out of the window), then "this week", so BookMeter has movement.
  await db.exec(`UPDATE book_views SET day = day - 100`);
  await recomputeRankings();
  await db.exec(`UPDATE book_views SET day = day + 100`);
  await recomputeRankings();

  console.log(`seed: ${books.length} books, ${authors.length} authors, ${userRows.length} users, ${ratings.size} ratings, ${reviews.length} reviews, ${listRows.length} lists in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("demo login: demo@booklore.app / booklore123");
}

main()
  .then(() => closeDb())
  .catch(async (e) => { console.error(e); await closeDb().catch(() => {}); process.exit(1); });
