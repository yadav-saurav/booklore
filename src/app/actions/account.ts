"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { recomputeBook } from "@/lib/aggregates";
import { touchedBookIds } from "@/lib/queries/users";

export type AccountFormState = { error?: string; saved?: boolean; fields?: Record<string, string> } | undefined;
export type AccountResult = { ok: true; following?: boolean } | { ok: false; error: string };

const ProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name (2+ characters)").max(40, "Keep your name under 40 characters"),
  bio: z.string().trim().max(300, "Keep your bio under 300 characters"),
  location: z.string().trim().max(80, "Keep your location under 80 characters"),
});

/** Display name, bio and location. */
export async function updateProfile(_: AccountFormState, form: FormData): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/settings");
  const raw = {
    displayName: String(form.get("displayName") ?? ""),
    bio: String(form.get("bio") ?? ""),
    location: String(form.get("location") ?? ""),
  };
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: raw };
  await db.run(`UPDATE users SET display_name = ?, bio = ?, location = ? WHERE id = ?`,
    parsed.data.displayName, parsed.data.bio, parsed.data.location || null, user.id);
  revalidatePath("/user", "layout");
  revalidatePath("/settings");
  return { saved: true };
}

const PasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "The new password must be at least 8 characters").max(200),
});

/** Change password after verifying the current one. */
export async function changePassword(_: AccountFormState, form: FormData): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/settings");
  const parsed = PasswordSchema.safeParse({
    currentPassword: String(form.get("currentPassword") ?? ""),
    newPassword: String(form.get("newPassword") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (String(form.get("confirmPassword") ?? "") !== parsed.data.newPassword) return { error: "The new passwords don't match" };
  const row = await db.get<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = ?`, user.id);
  if (!verifyPassword(parsed.data.currentPassword, row?.password_hash ?? null)) return { error: "Your current password is incorrect" };
  if (parsed.data.currentPassword === parsed.data.newPassword) return { error: "Choose a password you haven't used here before" };
  await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, hashPassword(parsed.data.newPassword), user.id);
  return { saved: true };
}

/** Permanently delete the account. The user must type their username to confirm. */
export async function deleteAccount(_: AccountFormState, form: FormData): Promise<AccountFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/settings");
  if (user.username === "demo") return { error: "The demo account can't be deleted, so it stays available for everyone to try." };
  const typed = String(form.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== user.username) return { error: `Type “${user.username}” exactly to confirm.` };
  const books = await touchedBookIds(user.id);
  // Deleting the user cascades to ratings, shelf, reviews, lists, follows and sessions.
  await db.run(`DELETE FROM users WHERE id = ?`, user.id);
  for (const b of books) await recomputeBook(b);
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Follow or unfollow another member. */
export async function toggleFollow(targetId: number): Promise<AccountResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const target = z.coerce.number().int().positive().parse(targetId);
  if (target === user.id) return { ok: false, error: "You can't follow yourself" };
  if (!(await db.get(`SELECT 1 FROM users WHERE id = ?`, target))) return { ok: false, error: "Member not found" };
  const exists = await db.get(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`, user.id, target);
  if (exists) await db.run(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`, user.id, target);
  else await db.run(`INSERT INTO follows (follower_id, followee_id) VALUES (?,?) ON CONFLICT DO NOTHING`, user.id, target);
  revalidatePath("/user", "layout");
  revalidatePath("/community");
  return { ok: true, following: !exists };
}
