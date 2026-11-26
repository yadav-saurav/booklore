import "server-only";
import type { BookCard } from "@/lib/queries/books";
import { CARD_COLUMNS, queryCards } from "@/lib/queries/books";

/**
 * Recommendation engine – PUBLIC CONTRACT (implementation owned by the recommendations workstream).
 * Other features import only these functions.
 */

export type Recommendation = BookCard & { reason: string | null };

/** Personalised picks for a user ("Top picks for you"). Falls back to popular, highly rated books for new users. */
export async function getRecommendationsForUser(userId: number | null, limit = 24): Promise<Recommendation[]> {
  void userId;
  return queryCards(`SELECT ${CARD_COLUMNS} FROM books b ORDER BY b.weighted_score DESC NULLS LAST LIMIT ?`, limit).map((b) => ({ ...b, reason: null }));
}

/** "More like this" for a book page. */
export async function getSimilarBooks(bookId: string, limit = 12): Promise<BookCard[]> {
  return queryCards(
    `SELECT ${CARD_COLUMNS} FROM books b WHERE b.id != ? AND b.id IN (
       SELECT bg2.book_id FROM book_genres bg1 JOIN book_genres bg2 ON bg2.genre_slug = bg1.genre_slug WHERE bg1.book_id = ?)
     ORDER BY b.weighted_score DESC NULLS LAST LIMIT ?`,
    bookId, bookId, limit,
  );
}

/** "Because you rated X" rails: seed books the user loved, each with similar picks. */
export async function getBecauseYouRated(userId: number, rails = 2, perRail = 12): Promise<{ seed: BookCard; books: BookCard[] }[]> {
  void userId; void rails; void perRail;
  return [];
}
