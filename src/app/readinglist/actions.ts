"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sqlite } from "@/db";
import { getCurrentUser } from "@/lib/auth";

/** Reading progress (pages read) for a book on the signed-in user's shelf. */
export async function updateShelfProgress(bookId: string, pagesRead: number): Promise<{ ok: true; progress: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const parsed = z.coerce.number().int().min(0).max(100000).safeParse(pagesRead);
  const id = z.string().min(1).max(200).safeParse(bookId);
  if (!parsed.success || !id.success) return { ok: false, error: "Enter a whole number of pages" };
  const row = sqlite
    .prepare(`SELECT b.pages FROM shelf s JOIN books b ON b.id = s.book_id WHERE s.user_id = ? AND s.book_id = ?`)
    .get(user.id, id.data) as { pages: number | null } | undefined;
  if (!row) return { ok: false, error: "That book isn't on your Reading List" };
  const progress = row.pages ? Math.min(parsed.data, row.pages) : parsed.data;
  sqlite.prepare(`UPDATE shelf SET progress = ?, updated_at = unixepoch() WHERE user_id = ? AND book_id = ?`).run(progress, user.id, id.data);
  revalidatePath("/readinglist");
  return { ok: true, progress };
}
