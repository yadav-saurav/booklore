"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { recomputeBook } from "@/lib/aggregates";
import type { ShelfStatus } from "@/db/schema";

export type ActionResult = { ok: true } | { ok: false; error: "auth" | "invalid" };

/** Rate a book 1–10, or pass null to remove the rating. Rating a book marks it "read". */
export async function rateBook(bookId: string, score: number | null): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 10)) return { ok: false, error: "invalid" };
  if (score === null) {
    await db.run(`DELETE FROM ratings WHERE user_id = ? AND book_id = ?`, user.id, bookId);
  } else {
    await db.run(
      `INSERT INTO ratings (user_id, book_id, score) VALUES (?,?,?)
       ON CONFLICT (user_id, book_id) DO UPDATE SET score = excluded.score, updated_at = unixepoch()`,
      user.id, bookId, score,
    );
    await db.run(
      `INSERT INTO shelf (user_id, book_id, status) VALUES (?,?,'read')
       ON CONFLICT (user_id, book_id) DO UPDATE SET status = 'read', updated_at = unixepoch()`,
      user.id, bookId,
    );
  }
  await recomputeBook(bookId);
  revalidatePath(`/book/${bookId}`);
  return { ok: true };
}

/** Set reading status (want / reading / read) or remove from shelves with null. */
export async function setShelf(bookId: string, status: ShelfStatus | null): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (status === null) {
    await db.run(`DELETE FROM shelf WHERE user_id = ? AND book_id = ?`, user.id, bookId);
  } else if (!["want", "reading", "read"].includes(status)) {
    return { ok: false, error: "invalid" };
  } else {
    await db.run(
      `INSERT INTO shelf (user_id, book_id, status) VALUES (?,?,?)
       ON CONFLICT (user_id, book_id) DO UPDATE SET status = excluded.status, updated_at = unixepoch()`,
      user.id, bookId, status,
    );
  }
  await recomputeBook(bookId);
  revalidatePath("/readinglist");
  return { ok: true };
}
