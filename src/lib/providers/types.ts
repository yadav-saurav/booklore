/**
 * Provider contract. Every external book source (Open Library, Google Books, …) implements
 * BookProvider and registers itself in ./registry.ts. Nothing else in the app talks to a
 * remote API directly, so adding a source = one new file + one line in the registry.
 */
export type ProviderId = "openlibrary" | "google";

export interface ExternalAuthorRef {
  name: string;
  externalId?: string; // provider-specific author id (OL: "OL23919A")
}

export interface ExternalBook {
  source: ProviderId;
  externalId: string; // OL work key "OL45883W" | Google volume id
  title: string;
  subtitle?: string | null;
  authors: ExternalAuthorRef[];
  firstPublishYear?: number | null;
  coverId?: number | null; // OL cover id
  coverUrl?: string | null; // absolute url for non-OL sources
  isbn13?: string | null;
  pages?: number | null;
  publisher?: string | null;
  language?: string | null;
  subjects: string[];
  description?: string | null;
  ratingAvg?: number | null; // normalised to 1–10
  ratingCount?: number | null;
  wantToRead?: number | null;
}

export interface ExternalAuthor {
  source: ProviderId;
  externalId: string;
  name: string;
  birthDate?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  photoId?: number | null;
  photoUrl?: string | null;
  topWork?: string | null;
  workCount?: number | null;
}

export interface SearchOptions {
  limit?: number;
  page?: number;
  /** narrow to field searches when supported */
  title?: string;
  author?: string;
  subject?: string;
  isbn?: string;
  sort?: "relevance" | "new" | "old" | "rating";
}

export interface BookProvider {
  id: ProviderId;
  name: string;
  /** Attribution shown next to imported data. */
  attribution: { label: string; url: string };
  enabled(): boolean;
  searchBooks(query: string, opts?: SearchOptions): Promise<ExternalBook[]>;
  getBook(externalId: string): Promise<ExternalBook | null>;
  searchAuthors?(query: string, opts?: { limit?: number }): Promise<ExternalAuthor[]>;
  getAuthor?(externalId: string): Promise<ExternalAuthor | null>;
  getAuthorWorks?(externalId: string, opts?: { limit?: number }): Promise<ExternalBook[]>;
}
