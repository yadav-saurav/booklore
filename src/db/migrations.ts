/**
 * Postgres schema migrations, embedded as strings so they ship with any bundler/serverless target.
 * Append new entries; never edit an applied one. Applied by src/db/index.ts on first use.
 *
 * Portability: plain Postgres 14+ with no extensions, so it runs on Neon, Supabase, Render, RDS, local
 * Postgres and PGlite. Booleans are stored as 0/1 integers and timestamps as unix seconds (bigint).
 */
export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "0001_init",
    sql: /* sql */ `
-- helpers (SQLite-compatible names used across the codebase)
CREATE OR REPLACE FUNCTION unixepoch() RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT extract(epoch FROM now())::bigint $$;
CREATE OR REPLACE FUNCTION _gc_sfunc(acc text, val text, sep text) RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT CASE WHEN val IS NULL THEN acc WHEN acc IS NULL THEN val ELSE acc || sep || val END $$;
CREATE OR REPLACE FUNCTION _gc_sfunc1(acc text, val text) RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT CASE WHEN val IS NULL THEN acc WHEN acc IS NULL THEN val ELSE acc || ',' || val END $$;
DROP AGGREGATE IF EXISTS group_concat(text, text);
DROP AGGREGATE IF EXISTS group_concat(text);
CREATE AGGREGATE group_concat(text, text) (SFUNC = _gc_sfunc, STYPE = text);
CREATE AGGREGATE group_concat(text) (SFUNC = _gc_sfunc1, STYPE = text);
-- accent folding without the unaccent extension (not available everywhere)
CREATE OR REPLACE FUNCTION unaccent_lite(t text) RETURNS text LANGUAGE sql IMMUTABLE AS
  $$ SELECT translate(lower(t), 'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūñçćčšžýÿ', 'aaaaaaaeeeeeiiiiiooooooouuuuunccczsyy') $$;

CREATE TABLE authors (
  id text PRIMARY KEY,
  ol_key text UNIQUE,
  name text NOT NULL,
  birth_date text,
  death_date text,
  photo_id integer,
  photo_url text,
  bio text,
  nationality text,
  source text NOT NULL DEFAULT 'seed',
  popularity double precision NOT NULL DEFAULT 0,
  created_at bigint NOT NULL DEFAULT unixepoch()
);

CREATE TABLE books (
  id text PRIMARY KEY,
  ol_work_key text UNIQUE,
  google_id text UNIQUE,
  title text NOT NULL,
  subtitle text,
  first_publish_year integer,
  cover_id integer,
  cover_url text,
  isbn13 text,
  pages integer,
  publisher text,
  language text,
  synopsis text,
  subjects text NOT NULL DEFAULT '[]',
  source text NOT NULL DEFAULT 'seed',
  ol_rating_avg double precision,
  ol_rating_count integer NOT NULL DEFAULT 0,
  ol_want_to_read integer NOT NULL DEFAULT 0,
  rating_avg double precision,
  rating_count integer NOT NULL DEFAULT 0,
  weighted_score double precision,
  review_count integer NOT NULL DEFAULT 0,
  shelf_count integer NOT NULL DEFAULT 0,
  popularity_score double precision NOT NULL DEFAULT 0,
  popularity_rank integer,
  prev_popularity_rank integer,
  created_at bigint NOT NULL DEFAULT unixepoch()
);
CREATE INDEX books_year_idx ON books (first_publish_year);
CREATE INDEX books_pop_idx ON books (popularity_rank);
CREATE INDEX books_weighted_idx ON books (weighted_score);

CREATE TABLE book_authors (
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, author_id)
);
CREATE INDEX ba_author_idx ON book_authors (author_id);

CREATE TABLE genres (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  kanji text,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE book_genres (
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  genre_slug text NOT NULL REFERENCES genres(slug) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_slug)
);
CREATE INDEX bg_genre_idx ON book_genres (genre_slug);

CREATE TABLE users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  email text UNIQUE,
  password_hash text,
  bio text NOT NULL DEFAULT '',
  location text,
  avatar_hue integer NOT NULL DEFAULT 220,
  is_mock integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL DEFAULT unixepoch()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);

CREATE TABLE follows (
  follower_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL DEFAULT unixepoch(),
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE ratings (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at bigint NOT NULL DEFAULT unixepoch(),
  updated_at bigint NOT NULL DEFAULT unixepoch(),
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX ratings_book_idx ON ratings (book_id);
CREATE INDEX ratings_created_idx ON ratings (created_at);

CREATE TABLE reviews (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  headline text NOT NULL,
  body text NOT NULL,
  spoiler integer NOT NULL DEFAULT 0,
  helpful_count integer NOT NULL DEFAULT 0,
  unhelpful_count integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL DEFAULT unixepoch(),
  updated_at bigint NOT NULL DEFAULT unixepoch(),
  UNIQUE (user_id, book_id)
);
CREATE INDEX reviews_book_idx ON reviews (book_id);

CREATE TABLE review_votes (
  review_id integer NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful integer NOT NULL,
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE review_reports (
  id serial PRIMARY KEY,
  review_id integer NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at bigint NOT NULL DEFAULT unixepoch()
);

CREATE TABLE shelf (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('want','reading','read')),
  progress integer,
  added_at bigint NOT NULL DEFAULT unixepoch(),
  updated_at bigint NOT NULL DEFAULT unixepoch(),
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX shelf_book_idx ON shelf (book_id);

CREATE TABLE lists (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_public integer NOT NULL DEFAULT 1,
  is_featured integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL DEFAULT unixepoch(),
  updated_at bigint NOT NULL DEFAULT unixepoch()
);

CREATE TABLE list_items (
  list_id integer NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position integer NOT NULL,
  note text,
  PRIMARY KEY (list_id, book_id)
);
CREATE INDEX li_book_idx ON list_items (book_id);

CREATE TABLE list_likes (
  list_id integer NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (list_id, user_id)
);

CREATE TABLE book_views (
  book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, day)
);

CREATE TABLE api_cache (
  key text PRIMARY KEY,
  value text NOT NULL,
  expires_at bigint NOT NULL
);

-- Full-text search document per book (replaces SQLite FTS5).
CREATE TABLE books_search (
  book_id text PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  doc tsvector NOT NULL
);
CREATE INDEX books_search_idx ON books_search USING gin (doc);
`,
  },
];
