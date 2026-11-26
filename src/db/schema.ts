/**
 * Row types for the BOOKLORE schema. The authoritative DDL lives in ./migrations.ts (Postgres).
 * Columns are snake_case in SQL; queries alias them to camelCase where the UI needs it.
 */

export type ShelfStatus = "want" | "reading" | "read";

export type Book = {
  id: string;
  ol_work_key: string | null;
  google_id: string | null;
  title: string;
  subtitle: string | null;
  first_publish_year: number | null;
  cover_id: number | null;
  cover_url: string | null;
  isbn13: string | null;
  pages: number | null;
  publisher: string | null;
  language: string | null;
  synopsis: string | null;
  subjects: string; // JSON array
  source: string;
  rating_avg: number | null;
  rating_count: number;
  weighted_score: number | null;
  review_count: number;
  shelf_count: number;
  popularity_score: number;
  popularity_rank: number | null;
  prev_popularity_rank: number | null;
  created_at: number;
};

export type Author = {
  id: string;
  ol_key: string | null;
  name: string;
  birth_date: string | null;
  death_date: string | null;
  photo_id: number | null;
  photo_url: string | null;
  bio: string | null;
  nationality: string | null;
  popularity: number;
};

export type User = {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  bio: string;
  location: string | null;
  avatar_hue: number;
  is_mock: number;
  created_at: number;
};
