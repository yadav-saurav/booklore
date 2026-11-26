"use server";

import { revalidatePath } from "next/cache";
import { rateBook, type ActionResult } from "@/app/actions/engagement";

/** Rate from the onboarding grid: reuses rateBook, then refreshes the picks page. */
export async function rateForPicks(bookId: string, score: number): Promise<ActionResult> {
  const r = await rateBook(bookId, score);
  if (r.ok) revalidatePath("/recommendations");
  return r;
}
