/**
 * BOOKLORE database access: one small async API over two Postgres drivers.
 *
 *   DATABASE_URL set   → postgres.js (Neon, Supabase, Render, RDS, any Postgres)
 *   DATABASE_URL unset → PGlite, an embedded Postgres stored in ./data/pglite (zero-setup local dev/tests)
 *
 * Queries are plain SQL with `?` placeholders (converted to $1..$n). Unquoted camelCase aliases after
 * AS are auto-quoted so `SELECT x AS coverId` keeps its casing. int8 and numeric come back as JS numbers.
 */
import path from "node:path";
import { MIGRATIONS } from "./migrations";

export type Row = Record<string, unknown>;
export interface Db {
  /** All rows. */
  all<T = Row>(text: string, ...params: unknown[]): Promise<T[]>;
  /** First row or undefined. */
  get<T = Row>(text: string, ...params: unknown[]): Promise<T | undefined>;
  /** Execute; returns affected row count. Use `RETURNING` + get() for generated ids. */
  run(text: string, ...params: unknown[]): Promise<{ rowCount: number }>;
  /** Multiple statements, no params (DDL / maintenance). */
  exec(text: string): Promise<void>;
  /** Run fn inside a transaction; the tx object has the same API. */
  tx<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/* ───────────── SQL translation ───────────── */

const cache = new Map<string, string>();
/**
 * `?` → `$n`, and double-quote every bare camelCase identifier so Postgres keeps its casing
 * (`SELECT x AS coverId`, `u.display_name displayName`, `ORDER BY ratingAvg`). Safe because every real
 * column/table in the schema is snake_case, so a camelCase token can only be an output alias.
 * Quoted strings, quoted identifiers, comments and $$-bodies are copied verbatim. Memoised per text.
 */
export function translate(text: string): string {
  const hit = cache.get(text);
  if (hit) return hit;
  let out = "";
  let code = ""; // pending unquoted chunk
  let n = 0;
  const flush = () => {
    out += code.replace(/(?<![\w."$])([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)\b(?!\s*\()/g, '"$1"').replace(/\?/g, () => `$${++n}`);
    code = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    let stop = -1;
    if (c === "'" || c === '"') stop = text.indexOf(c, i + 1);
    else if (c === "-" && text[i + 1] === "-") stop = text.indexOf("\n", i);
    else if (c === "$" && text[i + 1] === "$") { const e = text.indexOf("$$", i + 2); stop = e < 0 ? -1 : e + 1; }
    else { code += c; continue; }
    if (stop < 0) stop = text.length - 1;
    flush();
    out += text.slice(i, stop + 1);
    i = stop;
  }
  flush();
  if (cache.size < 5000) cache.set(text, out);
  return out;
}

// SQLite let callers pass booleans as 1/0; keep that contract so integer flag columns stay portable.
const fixParams = (ps: unknown[]) => ps.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p === undefined ? null : p));

/* ───────────── drivers ───────────── */

type Exec = {
  query(text: string, params: unknown[]): Promise<{ rows: Row[]; rowCount: number }>;
  exec(text: string): Promise<void>;
  tx<T>(fn: (e: Exec) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

function wrap(e: Exec): Db {
  return {
    async all<T>(text: string, ...params: unknown[]) {
      return (await e.query(translate(text), fixParams(params))).rows as T[];
    },
    async get<T>(text: string, ...params: unknown[]) {
      return (await e.query(translate(text), fixParams(params))).rows[0] as T | undefined;
    },
    async run(text: string, ...params: unknown[]) {
      return { rowCount: (await e.query(translate(text), fixParams(params))).rowCount };
    },
    exec: (text) => e.exec(text),
    tx: (fn) => e.tx((inner) => fn(wrap(inner))),
  };
}

async function createPostgresJs(url: string): Promise<Exec> {
  const { default: postgres } = await import("postgres");
  const num = { to: 0, from: [20, 1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) };
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
    prepare: false, // works through PgBouncer / Supabase & Neon poolers in transaction mode
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    types: { num } as never,
    ssl: /localhost|127\.0\.0\.1/.test(url) || /sslmode=disable/.test(url) ? false : "require",
  });
  // postgres.js's TransactionSql loses its call signatures in TS (Omit<>), so treat both as a loose handle.
  type Handle = { unsafe(text: string, params?: unknown[]): Promise<Row[] & { count: number }> };
  const make = (s: Handle): Exec => ({
    async query(text, params) {
      const r = await s.unsafe(text, params as never[]);
      return { rows: [...r] as Row[], rowCount: r.count ?? r.length };
    },
    async exec(text) { await s.unsafe(text); },
    tx: (fn) => (sql.begin((t) => fn(make(t as unknown as Handle))) as Promise<never>),
    close: () => sql.end({ timeout: 5 }),
  });
  return make(sql as unknown as Handle);
}

async function createPglite(dir: string): Promise<Exec> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const db = await PGlite.create(dir, { parsers: { [types.INT8]: Number, [types.NUMERIC]: Number } });
  type Q = { query: (t: string, p: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>; exec: (t: string) => Promise<unknown> };
  const make = (q: Q, inTx: boolean): Exec => ({
    async query(text, params) {
      const r = await q.query(text, params);
      return { rows: r.rows as Row[], rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(text) { await q.exec(text); },
    tx: inTx ? (fn) => fn(make(q, true)) : (fn) => db.transaction((t) => fn(make(t as unknown as Q, true))),
    close: () => db.close(),
  });
  return make(db as unknown as Q, false);
}

/* ───────────── lifecycle ───────────── */

async function migrate(e: Exec) {
  await e.tx(async (t) => {
    // Serialise concurrent cold starts (no-op on PGlite).
    await t.query("SELECT pg_advisory_xact_lock(727274)", []);
    await t.exec(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await t.query(`SELECT name FROM _migrations`, [])).rows.map((r) => r.name as string));
    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue;
      await t.exec(m.sql);
      await t.query(`INSERT INTO _migrations (name) VALUES ($1)`, [m.name]);
    }
  });
}

export const PGLITE_DIR = process.env.PGLITE_DIR || path.join(process.cwd(), "data", "pglite");

async function open(): Promise<Exec> {
  const url = process.env.DATABASE_URL;
  const e = url ? await createPostgresJs(url) : await createPglite(PGLITE_DIR);
  await migrate(e);
  return e;
}

const g = globalThis as unknown as { __bookloreDb?: Promise<Exec> };
function conn(): Promise<Exec> {
  if (!g.__bookloreDb) {
    g.__bookloreDb = open().catch((err) => {
      g.__bookloreDb = undefined; // allow retry on next request
      throw err;
    });
  }
  return g.__bookloreDb;
}

/** The app-wide database handle. Lazily connects and migrates on first use. */
export const db: Db = {
  all: async (t, ...p) => wrap(await conn()).all(t, ...p),
  get: async (t, ...p) => wrap(await conn()).get(t, ...p),
  run: async (t, ...p) => wrap(await conn()).run(t, ...p),
  exec: async (t) => wrap(await conn()).exec(t),
  tx: async (fn) => wrap(await conn()).tx(fn),
};

/** Rebuild one book's full-text search document (title A, authors B, subtitle C, subjects D). */
export async function reindexBook(bookId: string, d: Db = db) {
  await d.run(
    `INSERT INTO books_search (book_id, doc)
     SELECT b.id,
       setweight(to_tsvector('simple', unaccent_lite(b.title)), 'A') ||
       setweight(to_tsvector('simple', unaccent_lite(coalesce((SELECT string_agg(a.name, ' ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id), ''))), 'B') ||
       setweight(to_tsvector('simple', unaccent_lite(coalesce(b.subtitle, ''))), 'C') ||
       setweight(to_tsvector('simple', unaccent_lite(b.subjects)), 'D')
     FROM books b WHERE b.id = ?
     ON CONFLICT (book_id) DO UPDATE SET doc = excluded.doc`,
    bookId,
  );
}

/** Close the connection (scripts only). */
export async function closeDb() {
  const e = await g.__bookloreDb;
  g.__bookloreDb = undefined;
  await e?.close();
}
