import "server-only";
import type { BookCard } from "@/lib/queries/books";
import { getCardsByIds } from "@/lib/queries/books";
import { recommendIds, similarIds, becauseYouRatedIds } from "@/lib/recommend/engine";

/**
 * Recommendation engine – PUBLIC CONTRACT. Other features import only these functions.
 * Implementation: src/lib/recommend/{math,model,engine}.ts (hybrid item–item CF + content, MMR-diversified).
 */

export type Recommendation = BookCard & { reason: string | null };

function attach<T extends { id: string; reason: string | null }>(items: T[]): Recommendation[] {
  const cards = new Map(getCardsByIds(items.map((x) => x.id)).map((c) => [c.id, c]));
  return items.flatMap((x) => { const c = cards.get(x.id); return c ? [{ ...c, reason: x.reason }] : []; });
}

/** Personalised picks for a user ("Top picks for you"). Falls back to popular, highly rated books for new users. */
export async function getRecommendationsForUser(userId: number | null, limit = 24): Promise<Recommendation[]> {
  return attach(recommendIds(userId, limit));
}

/** "More like this" for a book page. Works for unrated / freshly imported books (content-only). */
export async function getSimilarBooks(bookId: string, limit = 12): Promise<BookCard[]> {
  return getCardsByIds(similarIds(bookId, limit).map((x) => x.id));
}

/** "Because you rated X" rails: seed books the user loved, each with similar picks. */
export async function getBecauseYouRated(userId: number, rails = 2, perRail = 12): Promise<{ seed: BookCard; books: BookCard[] }[]> {
  const out = becauseYouRatedIds(userId, rails, perRail);
  const seeds = new Map(getCardsByIds(out.map((r) => r.seed)).map((c) => [c.id, c]));
  return out.flatMap((r) => {
    const seed = seeds.get(r.seed);
    return seed ? [{ seed, books: getCardsByIds(r.items.map((x) => x.id)) }] : [];
  });
}
