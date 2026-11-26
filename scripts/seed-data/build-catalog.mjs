// Merges fetched Open Library data with the original synopses and author bios
// into the final seed files used by the app.
//
// Usage: node scripts/seed-data/build-catalog.mjs
//
// Reads   data/seed/books-raw.json, data/seed/authors-raw.json,
//         data/seed/synopses.json, data/seed/author-bios.json
// Writes  data/seed/books.json, data/seed/authors.json
// Exits non-zero if validation fails.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DATA = path.join(REPO_ROOT, 'data', 'seed');

const GENRES = new Set([
  'literary-fiction', 'classics', 'fantasy', 'science-fiction', 'mystery', 'thriller',
  'horror', 'romance', 'historical-fiction', 'young-adult', 'childrens', 'graphic-novels',
  'poetry', 'biography-memoir', 'history', 'science', 'philosophy', 'psychology',
  'self-help', 'business', 'true-crime', 'travel', 'humor',
]);

// Open Library uses MARC-style three-letter codes; the app uses ISO 639-1.
const LANG = {
  eng: 'en', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', spa: 'es', ita: 'it', por: 'pt',
  rus: 'ru', jpn: 'ja', chi: 'zh', zho: 'zh', ara: 'ar', per: 'fa', fas: 'fa', dut: 'nl',
  nld: 'nl', swe: 'sv', pol: 'pl', kor: 'ko', lat: 'la', gre: 'el', ell: 'el',
};

const readJson = async (name) => JSON.parse(await readFile(path.join(DATA, name), 'utf8'));

function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Keeps the first 13-digit ISBN that starts with 978 or 979.
function pickIsbn13(isbns) {
  for (const raw of isbns ?? []) {
    const digits = String(raw).replace(/[^0-9Xx]/g, '');
    if (/^97[89][0-9]{10}$/.test(digits)) return digits;
  }
  return null;
}

// Trims, dedupes case-insensitively, drops over-long or empty entries, keeps 12.
function cleanSubjects(subjects) {
  const seen = new Set();
  const out = [];
  for (const s of subjects ?? []) {
    const v = String(s).replace(/\s+/g, ' ').trim();
    if (!v || v.length > 60) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length === 12) break;
  }
  return out;
}

// Returns an ISO date for a full date string, a bare year, or null.
function cleanDate(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return v;
  const year = /\b(\d{4})\b/.exec(v);
  if (!year) return null;
  const parsed = new Date(v);
  if (/[A-Za-z]/.test(v) && !Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() === Number(year[1])) {
    return parsed.toISOString().slice(0, 10);
  }
  return year[1]; // year only, when OL gives no usable day
}

// Manual corrections for Open Library work matches that point at a later edition.
// Peter Pan first appeared as a play in 1904 and as the novel Peter and Wendy in 1911.
// The Iliad is a classical epic with no reliable first publication date.
const YEAR_OVERRIDES = { "Peter Pan": 1911, "The Iliad": null };

// Manual corrections for bad Open Library data, keyed by olKey.
const DEATH_OVERRIDES = {
  // Open Library lists a bogus death date for this living author.
  OL1394320A: null,
};

async function main() {
  const rawBooks = await readJson('books-raw.json');
  const rawAuthors = await readJson('authors-raw.json');
  const synopses = await readJson('synopses.json');
  const bios = await readJson('author-bios.json');
  const errors = [];

  // One canonical author key per curated author name: the primary key of the first book.
  const canonicalByName = {};
  for (const b of rawBooks) {
    if (!(b.inputAuthor in canonicalByName)) canonicalByName[b.inputAuthor] = b.authorKeys[0];
  }

  // Dedupe books by work key (keep first occurrence).
  const seenWork = new Set();
  const books = [];
  for (const b of rawBooks) {
    if (seenWork.has(b.olWorkKey)) continue;
    seenWork.add(b.olWorkKey);
    books.push(b);
  }

  // Assign unique ids: title slug, then slug plus work key suffix on collision.
  const idCount = {};
  for (const b of books) idCount[slugify(b.title)] = (idCount[slugify(b.title)] ?? 0) + 1;
  const usedIds = new Set();

  const outBooks = books.map((b) => {
    const base = slugify(b.title);
    let id = idCount[base] > 1 ? `${base}-${b.olWorkKey.toLowerCase()}` : base;
    if (usedIds.has(id)) id = `${id}-${b.olWorkKey.toLowerCase()}`;
    usedIds.add(id);

    const authorKey = canonicalByName[b.inputAuthor];
    const synopsis = synopses[b.olWorkKey];
    if (!synopsis) errors.push(`no synopsis for ${b.title} (${b.olWorkKey})`);
    for (const g of b.genres) if (!GENRES.has(g)) errors.push(`invalid genre ${g} on ${b.title}`);

    const lang = b.language ? LANG[b.language] ?? null : null;
    return {
      id,
      olWorkKey: b.olWorkKey,
      title: b.title,
      subtitle: b.subtitle ?? null,
      authorKeys: [authorKey],
      firstPublishYear: b.title in YEAR_OVERRIDES ? YEAR_OVERRIDES[b.title] : b.firstPublishYear ?? null,
      coverId: b.coverId ?? null,
      isbn13: pickIsbn13(b.isbn),
      pages: b.pages ?? null,
      publisher: b.publisher ?? null,
      language: lang,
      subjects: cleanSubjects(b.subjects),
      genres: b.genres,
      synopsis: synopsis ?? null,
      olRatingAvg: b.olRatingAvg == null ? null : Math.round(b.olRatingAvg * 100) / 100,
      olRatingCount: b.olRatingCount ?? 0,
      olWantToRead: b.olWantToRead ?? 0,
      olAlreadyRead: b.olAlreadyRead ?? 0,
    };
  });

  // Authors: only the canonical keys in use, with curated names and bios.
  const authorByKey = Object.fromEntries(rawAuthors.map((a) => [a.olKey, a]));
  const usedAuthorKeys = [...new Set(Object.values(canonicalByName))];
  const nameByKey = Object.fromEntries(Object.entries(canonicalByName).map(([name, key]) => [key, name]));
  const authorIds = new Set();
  const outAuthors = usedAuthorKeys.map((key) => {
    const raw = authorByKey[key] ?? {};
    const name = nameByKey[key];
    let id = slugify(name);
    if (authorIds.has(id)) id = `${id}-${key.toLowerCase()}`;
    authorIds.add(id);
    const bio = bios[key];
    if (!bio) errors.push(`no bio for ${name} (${key})`);
    const deathDate = key in DEATH_OVERRIDES ? DEATH_OVERRIDES[key] : cleanDate(raw.deathDate);
    return {
      id,
      olKey: key,
      name,
      birthDate: cleanDate(raw.birthDate),
      deathDate,
      photoId: raw.photoId ?? null,
      bio: bio?.bio ?? null,
      nationality: bio?.nationality ?? null,
    };
  });

  // Validation.
  const bookIds = new Set(outBooks.map((b) => b.id));
  if (bookIds.size !== outBooks.length) errors.push('duplicate book ids');
  const authorIdSet = new Set(outAuthors.map((a) => a.id));
  if (authorIdSet.size !== outAuthors.length) errors.push('duplicate author ids');
  const authorKeySet = new Set(outAuthors.map((a) => a.olKey));
  for (const b of outBooks) {
    for (const k of b.authorKeys) if (!authorKeySet.has(k)) errors.push(`unresolved authorKey ${k} on ${b.title}`);
    if (!b.synopsis) errors.push(`missing synopsis: ${b.title}`);
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }

  await writeFile(path.join(DATA, 'books.json'), JSON.stringify(outBooks, null, 2) + '\n');
  await writeFile(path.join(DATA, 'authors.json'), JSON.stringify(outAuthors, null, 2) + '\n');

  const genreCounts = {};
  for (const b of outBooks) for (const g of b.genres) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  const recent = outBooks.filter((b) => b.firstPublishYear >= 2022).length;
  const withCover = outBooks.filter((b) => b.coverId).length;
  console.log(JSON.stringify({
    books: outBooks.length,
    authors: outAuthors.length,
    withCover,
    booksFrom2022: recent,
    genres: Object.fromEntries(Object.entries(genreCounts).sort()),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
