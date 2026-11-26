import type { BookProvider, ExternalBook, SearchOptions } from "./types";
import { cachedJson } from "./http";

/**
 * Google Books – optional secondary source. Works keyless at low volume; set GOOGLE_BOOKS_API_KEY
 * for a higher free quota. Disable with BOOKLORE_DISABLE_GOOGLE=1.
 */
const BASE = "https://www.googleapis.com/books/v1/volumes";

type Vol = {
  id: string;
  volumeInfo: {
    title: string; subtitle?: string; authors?: string[]; publishedDate?: string; publisher?: string;
    description?: string; pageCount?: number; categories?: string[]; language?: string;
    averageRating?: number; ratingsCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
};

const key = () => (process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : "");

function fromVol(v: Vol): ExternalBook {
  const i = v.volumeInfo;
  const thumb = i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail;
  return {
    source: "google",
    externalId: v.id,
    title: i.title,
    subtitle: i.subtitle ?? null,
    authors: (i.authors ?? []).map((name) => ({ name })),
    firstPublishYear: i.publishedDate ? parseInt(i.publishedDate.slice(0, 4)) || null : null,
    coverUrl: thumb ? thumb.replace("http://", "https://").replace("&edge=curl", "") : null,
    isbn13: i.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier ?? null,
    pages: i.pageCount ?? null,
    publisher: i.publisher ?? null,
    language: i.language ?? null,
    subjects: (i.categories ?? []).flatMap((c) => c.split(" / ")).slice(0, 12),
    description: i.description?.replace(/<[^>]+>/g, "") ?? null,
    ratingAvg: i.averageRating ? i.averageRating * 2 : null,
    ratingCount: i.ratingsCount ?? null,
  };
}

export const googleBooks: BookProvider = {
  id: "google",
  name: "Google Books",
  attribution: { label: "Google Books", url: "https://books.google.com" },
  enabled: () => process.env.BOOKLORE_DISABLE_GOOGLE !== "1",

  async searchBooks(query: string, opts: SearchOptions = {}) {
    const parts = [query];
    if (opts.title) parts.push(`intitle:${opts.title}`);
    if (opts.author) parts.push(`inauthor:${opts.author}`);
    if (opts.subject) parts.push(`subject:${opts.subject}`);
    if (opts.isbn) parts.push(`isbn:${opts.isbn}`);
    const q = encodeURIComponent(parts.filter(Boolean).join(" "));
    const limit = Math.min(opts.limit ?? 20, 40);
    const start = ((opts.page ?? 1) - 1) * limit;
    const order = opts.sort === "new" ? "&orderBy=newest" : "";
    const data = await cachedJson<{ items?: Vol[] }>(`${BASE}?q=${q}&maxResults=${limit}&startIndex=${start}&printType=books${order}${key()}`, 60 * 60 * 6);
    return (data?.items ?? []).map(fromVol);
  },

  async getBook(id: string) {
    const v = await cachedJson<Vol>(`${BASE}/${encodeURIComponent(id)}?${key().slice(1)}`, 60 * 60 * 24 * 7);
    return v?.volumeInfo ? fromVol(v) : null;
  },
};
