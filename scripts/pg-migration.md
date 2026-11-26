# SQLite → Postgres migration guide (for workstream agents)

BOOKLORE now runs on Postgres. In production, set `DATABASE_URL` to Neon, Supabase, Render or any other Postgres. Locally, embedded PGlite is used when `DATABASE_URL` is unset. Migrate ONLY the files your workstream owns; the shared core is already done.

## API (src/db/index.ts)
```ts
import { db } from "@/db";
await db.all<T>(sql, ...params)   // was sqlite.prepare(sql).all(...params)
await db.get<T>(sql, ...params)   // was .get(...)   → T | undefined
await db.run(sql, ...params)      // was .run(...)   → { rowCount }
await db.exec(sqlMulti)           // multi-statement, no params
await db.tx(async (t) => { await t.run(...); })   // was sqlite.transaction(() => {...})()
```
- Keep `?` placeholders; they're converted to `$n` automatically.
- camelCase aliases (`x AS coverId`, `u.display_name displayName`, `ORDER BY ratingAvg`) are auto-quoted, so keep writing them as before. Every real column is snake_case.
- `count(*)`, `sum()`, `avg()` and numeric values come back as JS numbers. Booleans are still 0/1 integers (`is_mock`, `spoiler`, `is_public`, `is_featured`, `helpful`), so `= 1` comparisons still work, and JS `true`/`false` params are converted to 1/0.
- Timestamps are unix seconds (bigint→number). `unixepoch()` and `group_concat(x[, sep])` exist as SQL helpers. Prefer `string_agg(x, sep ORDER BY …)` when order matters.
- Everything is async now: functions become `async` and callers `await`. Server components can await directly.

## Already-async shared functions (await them)
- `queryCards`, `getCardsByIds`, `getUserStates`, `getGenres` (src/lib/queries/books.ts)
- `searchLocalBooks`, `searchLocalAuthors`, plus new `countLocalBooks` (src/lib/search.ts)
- `recomputeBook`, `recomputeRankings`, `maybeRefreshRankings`, `recordView` (src/lib/aggregates.ts)
- `findLocalByExternal`, `importExternalBook`, `resolveExternalRef`, `hydrateAuthor` (src/lib/catalog.ts)
- `reindexBook(id, t?)` (src/db)
- `getRecommendationsForUser`, `getSimilarBooks`, `getBecauseYouRated` were already async.

## Dialect changes
| SQLite | Postgres |
|---|---|
| `INSERT OR IGNORE INTO t …` | `INSERT INTO t … ON CONFLICT DO NOTHING` |
| `INSERT OR REPLACE` | `… ON CONFLICT (pk cols) DO UPDATE SET col = excluded.col` |
| `ON CONFLICT(...) DO UPDATE SET n = n + 1` | qualify the column: `SET n = tablename.n + 1` |
| `r.lastInsertRowid` | `INSERT … RETURNING id` + `db.get<{id:number}>` |
| `date('now','-7 days')` | `current_date - 7` (book_views.day is `date`) |
| `strftime('%Y', ts, 'unixepoch')` | `extract(year from to_timestamp(ts))::int` |
| `LIKE` (case-insensitive in SQLite) | `ILIKE`, or `unaccent_lite(col) LIKE unaccent_lite(?)` |
| `ifnull(a,b)` | `coalesce(a,b)` |
| scalar `max(a,b)` / `min(a,b)` | `greatest(a,b)` / `least(a,b)` |
| `iif(c,a,b)` | `CASE WHEN c THEN a ELSE b END` |
| `round(float_expr, 1)` | `round((float_expr)::numeric, 1)` |
| `x / y` with two ints | same integer division; cast `::float8` when you want a fraction |
| `books_fts MATCH ?` / `bm25` | use `searchLocalBooks` / `countLocalBooks`, or `books_search s … WHERE s.doc @@ to_tsquery('simple', ?)` with `tsQuery(q)` from src/lib/search.ts |
| `json_each(subjects)` | `jsonb_array_elements_text(subjects::jsonb)` |
| `random()` | same |
| `"string"` with double quotes | single quotes only (double quotes are identifiers) |

Watch for these:
- **GROUP BY is strict.** Every selected non-aggregated column must be in GROUP BY, or be functionally dependent on a grouped primary key, e.g. `GROUP BY b.id` lets you select other `b.*` columns.
- **SELECT DISTINCT … ORDER BY x** requires `x` in the select list.
- **Param types matter.** Pass numbers for integer columns (`Number(id)`, not strings from URL params). `LIMIT ?`/`OFFSET ?` must be numbers.
- **Aliases** can't be referenced in WHERE or HAVING (only in ORDER BY), same as standard SQL.
- **NULLS sort last in ASC by default** in Postgres; SQLite sorted them first. Add `NULLS LAST`/`NULLS FIRST` where it matters.
- **Booleans:** a comparison like `x > 0 AS flag` returns a real boolean. That's fine in JS.

## Testing
- A shared, seeded Postgres 16 is running: `DATABASE_URL=postgres://booklore:booklore@localhost:5432/booklore`.
- Run your dev server with it plus your own port and dist dir:
  `DATABASE_URL=postgres://booklore:booklore@localhost:5432/booklore NODE_USE_ENV_PROXY=1 NEXT_DIST_DIR=.next-<name> npx next dev -p <port>`
- Don't reseed and don't TRUNCATE. Test-created rows are fine; delete the ones you create when done.
- Done means:
  - `npx tsc --noEmit` is clean for your files
  - `grep -n "sqlite" <your files>` is empty
  - every one of your routes returns 200 with real data (curl)
  - your write flows (server actions) work against Postgres
  - your vitest tests pass
- Then stop your dev server. Don't commit (the lead commits). Report in under 120 words.
