"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { recomputeBook } from "@/lib/aggregates";
import { rateBook, type ActionResult } from "@/app/actions/engagement";

export type ReviewResult = ActionResult | { ok: false; error: "invalid"; message: string };

const ReviewSchema = z.object({
  bookId: z.string().min(1).max(200),
  headline: z.string().trim().min(3, "Add a headline (at least 3 characters)").max(120, "Headline is too long (120 max)"),
  body: z.string().trim().min(50, "Your review needs at least 50 characters").max(10000, "Review is too long (10,000 max)"),
  spoiler: z.boolean(),
  rating: z.number().int().min(1, "Choose a rating").max(10),
});

const refresh = (bookId: string) => {
  revalidatePath(`/book/${bookId}`);
  revalidatePath(`/book/${bookId}/reviews`);
};

/** Create or update the signed-in user's review (one per book). Rating is required and saved via rateBook. */
export async function saveReview(input: z.input<typeof ReviewSchema>): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const parsed = ReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", message: parsed.error.issues[0].message };
  const { bookId, headline, body, spoiler, rating } = parsed.data;
  if (!await db.get(`SELECT 1 FROM books WHERE id = ?`, bookId)) return { ok: false, error: "invalid", message: "Book not found" };
  const rated = await rateBook(bookId, rating);
  if (!rated.ok) return rated;
  await db.run(
      `INSERT INTO reviews (user_id, book_id, headline, body, spoiler) VALUES (?,?,?,?,?)
       ON CONFLICT(user_id, book_id) DO UPDATE SET headline = excluded.headline, body = excluded.body,
         spoiler = excluded.spoiler, updated_at = unixepoch()`, user.id, bookId, headline, body, spoiler ? 1 : 0);
  await recomputeBook(bookId);
  refresh(bookId);
  return { ok: true };
}

const Id = z.number().int().positive();

export async function deleteReview(reviewId: number): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!Id.safeParse(reviewId).success) return { ok: false, error: "invalid" };
  const r = await db.get(`SELECT book_id, user_id FROM reviews WHERE id = ?`, reviewId) as { book_id: string; user_id: number } | undefined;
  if (!r || r.user_id !== user.id) return { ok: false, error: "invalid", message: "You can only delete your own review" };
  await db.run(`DELETE FROM reviews WHERE id = ?`, reviewId);
  await recomputeBook(r.book_id);
  refresh(r.book_id);
  return { ok: true };
}

/**
 * Helpful / Not helpful. One vote per user; voting the same way again removes the vote,
 * voting the other way switches it. Counts are adjusted incrementally (seeded counts have no vote rows).
 */
export async function voteReview(reviewId: number, helpful: boolean): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const p = z.object({ reviewId: Id, helpful: z.boolean() }).safeParse({ reviewId, helpful });
  if (!p.success) return { ok: false, error: "invalid" };
  const r = await db.get(`SELECT book_id, user_id FROM reviews WHERE id = ?`, reviewId) as { book_id: string; user_id: number } | undefined;
  if (!r) return { ok: false, error: "invalid", message: "Review not found" };
  if (r.user_id === user.id) return { ok: false, error: "invalid", message: "You can't vote on your own review" };
  await db.tx(async (t) => {
    const prev = await t.get(`SELECT helpful FROM review_votes WHERE review_id = ? AND user_id = ?`, reviewId, user.id) as { helpful: number } | undefined;
    const bump = (h: boolean, d: number) =>
      t.run(`UPDATE reviews SET ${h ? "helpful_count" : "unhelpful_count"} = greatest(0, ${h ? "helpful_count" : "unhelpful_count"} + ?) WHERE id = ?`, d, reviewId);
    if (prev) {
      await t.run(`DELETE FROM review_votes WHERE review_id = ? AND user_id = ?`, reviewId, user.id);
      await bump(!!prev.helpful, -1);
      if (!!prev.helpful === helpful) return; // toggled off
    }
    await t.run(`INSERT INTO review_votes (review_id, user_id, helpful) VALUES (?,?,?)`, reviewId, user.id, helpful ? 1 : 0);
    await bump(helpful, 1);
  });
  refresh(r.book_id);
  return { ok: true };
}

const ReportSchema = z.object({ reviewId: Id, reason: z.enum(["spoiler", "offensive", "spam", "off-topic", "other"]) });

export async function reportReview(reviewId: number, reason: string): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const p = ReportSchema.safeParse({ reviewId, reason });
  if (!p.success) return { ok: false, error: "invalid", message: "Choose a reason" };
  const r = await db.get(`SELECT book_id FROM reviews WHERE id = ?`, reviewId) as { book_id: string } | undefined;
  if (!r) return { ok: false, error: "invalid", message: "Review not found" };
  if (!await db.get(`SELECT 1 FROM review_reports WHERE review_id = ? AND user_id = ?`, reviewId, user.id))
    await db.run(`INSERT INTO review_reports (review_id, user_id, reason) VALUES (?,?,?)`, reviewId, user.id, p.data.reason);
  refresh(r.book_id);
  return { ok: true };
}
