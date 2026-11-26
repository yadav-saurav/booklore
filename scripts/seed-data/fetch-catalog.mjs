// Fetches book and author metadata from Open Library for the BOOKLORE seed catalog.
//
// Usage: node scripts/seed-data/fetch-catalog.mjs
//
// Reads   scripts/seed-data/books-input.json
// Caches  scripts/seed-data/.cache.json (keyed by request URL, so re-runs are fast)
// Writes  data/seed/books-raw.json, data/seed/authors-raw.json, data/seed/fetch-report.txt

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const INPUT_PATH = path.join(HERE, 'books-input.json');
const CACHE_PATH = path.join(HERE, '.cache.json');
const OUT_DIR = path.join(REPO_ROOT, 'data', 'seed');
const BOOKS_OUT = path.join(OUT_DIR, 'books-raw.json');
const AUTHORS_OUT = path.join(OUT_DIR, 'authors-raw.json');
const REPORT_OUT = path.join(OUT_DIR, 'fetch-report.txt');

const USER_AGENT = 'BookloreSeed/1.0 (dev seed script)';
const DELAY_MS = 350;
const RETRIES = 2; // retries after the first attempt
const SEARCH_FIELDS = [
  'key', 'title', 'subtitle', 'author_name', 'author_key', 'first_publish_year',
  'cover_i', 'number_of_pages_median', 'isbn', 'publisher', 'language', 'subject',
  'ratings_average', 'ratings_count', 'want_to_read_count', 'already_read_count',
].join(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  } catch {
    console.warn('Cache file unreadable, starting fresh.');
    return {};
  }
}

// Requests are paced at DELAY_MS, measured from the previous network request.
let lastRequestAt = 0;

async function getJson(url, cache) {
  if (Object.prototype.hasOwnProperty.call(cache, url)) return cache[url];

  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404) {
        cache[url] = null; // definitive miss, cache it
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      cache[url] = body;
      if (Object.keys(cache).length % 25 === 0) await writeFile(CACHE_PATH, JSON.stringify(cache) + '\n');
      return body;
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) await sleep(DELAY_MS * (attempt + 2));
    }
  }
  console.warn(`  giving up on ${url}: ${lastError?.message ?? lastError}`);
  return null;
}

function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleScore(wanted, candidate) {
  const a = normalize(wanted);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (b.startsWith(a + ' ') || a.startsWith(b + ' ')) return 2;
  if (b.includes(a) || a.includes(b)) return 1;
  return 0;
}

function authorScore(wanted, names) {
  const last = normalize(wanted).split(' ').filter(Boolean).pop() ?? '';
  if (!last || !Array.isArray(names)) return 0;
  return names.some((n) => normalize(n).includes(last)) ? 1 : 0;
}

// Picks the best search doc: exact-ish title first, then author agreement, then cover_i.
function pickBest(input, docs) {
  let best = null;
  let bestScore = -1;
  for (const doc of docs ?? []) {
    const ts = titleScore(input.searchTitle ?? input.title, doc.title);
    if (ts === 0) continue; // never accept an unrelated title
    const score = ts * 10 + authorScore(input.author, doc.author_name) * 5 + (doc.cover_i ? 4 : 0);
    if (score > bestScore) {
      best = doc;
      bestScore = score;
    }
  }
  return best;
}

// Keeps only the author keys whose name matches the input author (translators,
// editors and illustrators are dropped). Falls back to the first key.
function primaryAuthorKeys(input, doc) {
  const keys = doc.author_key ?? [];
  const names = doc.author_name ?? [];
  const last = normalize(input.author).split(' ').filter(Boolean).pop() ?? '';
  const matched = keys.filter((_, i) => last && normalize(names[i] ?? '').includes(last));
  return (matched.length ? matched : keys.slice(0, 1)).slice(0, 3);
}

function toRawBook(input, doc) {
  return {
    inputTitle: input.title,
    inputAuthor: input.author,
    genres: input.genres,
    olWorkKey: String(doc.key).replace(/^\/works\//, ''),
    title: input.title,
    subtitle: doc.subtitle ?? null,
    authorKeys: primaryAuthorKeys(input, doc),
    authorNames: doc.author_name ?? [],
    firstPublishYear: doc.first_publish_year ?? null,
    coverId: doc.cover_i ?? null,
    pages: doc.number_of_pages_median ?? null,
    isbn: doc.isbn ?? [],
    publisher: (doc.publisher ?? [])[0] ?? null,
    language: (doc.language ?? [])[0] ?? null,
    subjects: doc.subject ?? [],
    olRatingAvg: doc.ratings_average ?? null,
    olRatingCount: doc.ratings_count ?? 0,
    olWantToRead: doc.want_to_read_count ?? 0,
    olAlreadyRead: doc.already_read_count ?? 0,
  };
}

async function main() {
  const inputs = JSON.parse(await readFile(INPUT_PATH, 'utf8'));
  const cache = await loadCache();
  const started = Date.now();

  console.log(`Searching ${inputs.length} books (cache entries: ${Object.keys(cache).length})...`);

  const books = [];
  const misses = [];
  const noCover = [];

  for (const [i, input] of inputs.entries()) {
    const params = new URLSearchParams({
      title: input.searchTitle ?? input.title,
      author: input.author,
      limit: '3',
      fields: SEARCH_FIELDS,
    });
    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    const body = await getJson(url, cache);
    const doc = pickBest(input, body?.docs);

    if (!doc) {
      misses.push(input);
      console.log(`[${i + 1}] NO MATCH  ${input.title} / ${input.author}`);
      continue;
    }
    const raw = toRawBook(input, doc);
    books.push(raw);
    if (!raw.coverId) {
      noCover.push(raw);
      console.log(`[${i + 1}] no cover  ${raw.title} (${raw.olWorkKey})`);
    }
  }

  // Authors: unique keys across matched books, each fetched once.
  const authorKeys = [...new Set(books.flatMap((b) => b.authorKeys))];
  console.log(`Fetching ${authorKeys.length} authors...`);

  const authors = [];
  for (const key of authorKeys) {
    const body = await getJson(`https://openlibrary.org/authors/${key}.json`, cache);
    const photoId = (body?.photos ?? []).find((p) => typeof p === 'number' && p > 0) ?? null;
    authors.push({
      olKey: key,
      name: body?.name ?? null,
      birthDate: body?.birth_date ?? null,
      deathDate: body?.death_date ?? null,
      photoId,
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(BOOKS_OUT, JSON.stringify(books, null, 2) + '\n');
  await writeFile(AUTHORS_OUT, JSON.stringify(authors, null, 2) + '\n');
  await writeFile(CACHE_PATH, JSON.stringify(cache) + '\n');

  const withCover = books.filter((b) => b.coverId).length;
  const lines = [
    `BOOKLORE seed fetch report (${new Date().toISOString()})`,
    `Inputs: ${inputs.length}`,
    `Matched: ${books.length}`,
    `With cover: ${withCover}`,
    `Authors: ${authors.length} (with photo: ${authors.filter((a) => a.photoId).length})`,
    '',
    `No match (${misses.length}):`,
    ...misses.map((m) => `  - ${m.title} / ${m.author}`),
    '',
    `Matched without cover (${noCover.length}):`,
    ...noCover.map((b) => `  - ${b.title} / ${b.inputAuthor} [${b.olWorkKey}]`),
    '',
  ];
  await writeFile(REPORT_OUT, lines.join('\n'));

  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)}s: ${books.length} matched, ` +
      `${withCover} with cover, ${misses.length} unmatched, ${authors.length} authors.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
