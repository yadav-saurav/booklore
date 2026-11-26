import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "booklore.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  ensureSearchIndex(sqlite);
  return { sqlite, db };
}

/** FTS5 index over the catalog (title, subtitle, authors, subjects). Rebuilt via reindexBook(). */
function ensureSearchIndex(sqlite: Database.Database) {
  sqlite.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
    book_id UNINDEXED, title, subtitle, authors, subjects, tokenize='unicode61 remove_diacritics 2');`);
}

// Reuse a single connection across hot reloads in dev.
const g = globalThis as unknown as { __booklore?: ReturnType<typeof open> };
const conn = g.__booklore ?? (g.__booklore = open());

export const db = conn.db;
export const sqlite = conn.sqlite;
export { schema };

export function reindexBook(bookId: string) {
  const row = sqlite
    .prepare(
      `SELECT b.id, b.title, coalesce(b.subtitle,'') subtitle, b.subjects,
        coalesce((SELECT group_concat(a.name, ' ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id), '') authors
       FROM books b WHERE b.id = ?`,
    )
    .get(bookId) as { id: string; title: string; subtitle: string; subjects: string; authors: string } | undefined;
  sqlite.prepare(`DELETE FROM books_fts WHERE book_id = ?`).run(bookId);
  if (!row) return;
  const subjects = (JSON.parse(row.subjects || "[]") as string[]).join(" ");
  sqlite
    .prepare(`INSERT INTO books_fts (book_id, title, subtitle, authors, subjects) VALUES (?,?,?,?,?)`)
    .run(row.id, row.title, row.subtitle, row.authors, subjects);
}
