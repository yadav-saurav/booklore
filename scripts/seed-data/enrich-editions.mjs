// Fetches full language/publisher lists per work (batched) so the seed can prefer English editions.
// Usage: NODE_USE_ENV_PROXY=1 node scripts/seed-data/enrich-editions.mjs
import fs from "node:fs";
const books = JSON.parse(fs.readFileSync("data/seed/books.json", "utf8"));
const out = {};
for (let i = 0; i < books.length; i += 40) {
  const keys = books.slice(i, i + 40).map((b) => `key:"/works/${b.olWorkKey}"`).join(" OR ");
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(keys)}&fields=key,language,publisher&limit=50`;
  const res = await fetch(url, { headers: { "User-Agent": "BookloreSeed/1.0 (dev seed script)" } });
  const data = await res.json();
  for (const d of data.docs) out[d.key.split("/").pop()] = { language: d.language ?? [], publisher: (d.publisher ?? []).slice(0, 40) };
  await new Promise((r) => setTimeout(r, 400));
}
fs.writeFileSync("data/seed/editions.json", JSON.stringify(out));
console.log("works enriched:", Object.keys(out).length, "/", books.length);
