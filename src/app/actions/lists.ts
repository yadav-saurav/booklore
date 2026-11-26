"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sqlite } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveExternalRef } from "@/lib/catalog";
import { getMyListsWithBook } from "@/lib/queries/lists";

export type ListFormState = { error?: string; saved?: boolean; fields?: Record<string, string> } | undefined;
export type ListResult = { ok: true } | { ok: false; error: string };

const id = z.coerce.number().int().positive();
const bookId = z.string().min(1).max(200);

const ListFields = z.object({
  title: z.string().trim().min(2, "Give the list a title of at least 2 characters").max(120, "Keep the title under 120 characters"),
  description: z.string().trim().max(500, "Keep the description under 500 characters"),
  isPublic: z.boolean(),
});

function readFields(form: FormData) {
  return {
    title: String(form.get("title") ?? ""),
    description: String(form.get("description") ?? ""),
    isPublic: form.get("isPublic") === "on",
  };
}

/** Owner-only: returns the list row when the signed-in user owns it. */
function ownedList(listId: number, userId: number) {
  const row = sqlite.prepare(`SELECT id, user_id AS userId FROM lists WHERE id = ?`).get(listId) as { id: number; userId: number } | undefined;
  return row && row.userId === userId ? row : null;
}

const touch = (listId: number) => sqlite.prepare(`UPDATE lists SET updated_at = unixepoch() WHERE id = ?`).run(listId);

function revalidateList(listId: number) {
  revalidatePath(`/list/${listId}`);
  revalidatePath(`/list/${listId}/edit`);
  revalidatePath("/lists");
  revalidatePath("/user", "layout");
}

function nextPosition(listId: number): number {
  return ((sqlite.prepare(`SELECT max(position) m FROM list_items WHERE list_id = ?`).get(listId) as { m: number | null }).m ?? -1) + 1;
}

/* ───────────── List metadata ───────────── */

export async function createList(_: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/list/new");
  const raw = readFields(form);
  const parsed = ListFields.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { title: raw.title, description: raw.description } };
  const r = sqlite
    .prepare(`INSERT INTO lists (user_id, title, description, is_public) VALUES (?,?,?,?)`)
    .run(user.id, parsed.data.title, parsed.data.description, parsed.data.isPublic ? 1 : 0);
  revalidatePath("/lists");
  redirect(`/list/${Number(r.lastInsertRowid)}/edit`);
}

export async function updateList(listId: number, _: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to edit lists" };
  if (!ownedList(id.parse(listId), user.id)) return { error: "You can only edit your own lists" };
  const raw = readFields(form);
  const parsed = ListFields.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { title: raw.title, description: raw.description } };
  sqlite
    .prepare(`UPDATE lists SET title = ?, description = ?, is_public = ?, updated_at = unixepoch() WHERE id = ?`)
    .run(parsed.data.title, parsed.data.description, parsed.data.isPublic ? 1 : 0, listId);
  revalidateList(listId);
  return { saved: true };
}

export async function deleteList(listId: number): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!ownedList(id.parse(listId), user.id)) return { ok: false, error: "You can only delete your own lists" };
  sqlite.prepare(`DELETE FROM lists WHERE id = ?`).run(listId);
  revalidatePath("/lists");
  revalidatePath("/user", "layout");
  redirect(`/user/${user.username}/lists`);
}

/** Quick create from AddToListButton: returns the new list instead of redirecting. */
export async function createListQuick(input: { title: string; bookId?: string }): Promise<({ ok: true; id: number; title: string } & { included: boolean }) | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const title = z.string().trim().min(2).max(120).safeParse(input.title);
  if (!title.success) return { ok: false, error: "Give the list a title of at least 2 characters" };
  const r = sqlite.prepare(`INSERT INTO lists (user_id, title, description, is_public) VALUES (?,?,'',1)`).run(user.id, title.data);
  const listId = Number(r.lastInsertRowid);
  let included = false;
  if (input.bookId) {
    const bid = bookId.safeParse(input.bookId);
    if (bid.success && sqlite.prepare(`SELECT 1 FROM books WHERE id = ?`).get(bid.data)) {
      sqlite.prepare(`INSERT INTO list_items (list_id, book_id, position) VALUES (?,?,0)`).run(listId, bid.data);
      included = true;
    }
  }
  revalidatePath("/lists");
  revalidatePath("/user", "layout");
  return { ok: true, id: listId, title: title.data, included };
}

/* ───────────── Items ───────────── */

/** Toggle a local book in one of the user's lists (AddToListButton). */
export async function toggleBookInList(listId: number, bookIdValue: string): Promise<{ ok: true; included: boolean } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const bid = bookId.parse(bookIdValue);
  if (!ownedList(lid, user.id)) return { ok: false, error: "You can only edit your own lists" };
  const exists = sqlite.prepare(`SELECT 1 FROM list_items WHERE list_id = ? AND book_id = ?`).get(lid, bid);
  if (exists) {
    sqlite.prepare(`DELETE FROM list_items WHERE list_id = ? AND book_id = ?`).run(lid, bid);
  } else {
    if (!sqlite.prepare(`SELECT 1 FROM books WHERE id = ?`).get(bid)) return { ok: false, error: "Book not found" };
    sqlite.prepare(`INSERT INTO list_items (list_id, book_id, position) VALUES (?,?,?)`).run(lid, bid, nextPosition(lid));
  }
  touch(lid);
  revalidateList(lid);
  return { ok: true, included: !exists };
}

/** Add a book by id (local slug). Used by the list editor's search. */
export async function addBookToList(listId: number, bookIdValue: string): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const bid = bookId.parse(bookIdValue);
  if (!ownedList(lid, user.id)) return { ok: false, error: "You can only edit your own lists" };
  if (!sqlite.prepare(`SELECT 1 FROM books WHERE id = ?`).get(bid)) return { ok: false, error: "Book not found" };
  sqlite.prepare(`INSERT OR IGNORE INTO list_items (list_id, book_id, position) VALUES (?,?,?)`).run(lid, bid, nextPosition(lid));
  touch(lid);
  revalidateList(lid);
  return { ok: true };
}

/** Add a book by "<source>:<externalId>" – imports it into the catalog first. */
export async function addBookByRef(listId: number, ref: string): Promise<({ ok: true; bookId: string } | { ok: false; error: string })> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const parsedRef = z.string().min(3).max(300).regex(/^[a-z]+:[^\s]+$/, "Unrecognised book reference").safeParse(ref);
  if (!parsedRef.success) return { ok: false, error: parsedRef.error.issues[0].message };
  if (!ownedList(lid, user.id)) return { ok: false, error: "You can only edit your own lists" };
  const slug = await resolveExternalRef(parsedRef.data);
  if (!slug) return { ok: false, error: "Could not find that book" };
  sqlite.prepare(`INSERT OR IGNORE INTO list_items (list_id, book_id, position) VALUES (?,?,?)`).run(lid, slug, nextPosition(lid));
  touch(lid);
  revalidateList(lid);
  return { ok: true, bookId: slug };
}

export async function removeBookFromList(listId: number, bookIdValue: string): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  if (!ownedList(lid, user.id)) return { ok: false, error: "You can only edit your own lists" };
  sqlite.prepare(`DELETE FROM list_items WHERE list_id = ? AND book_id = ?`).run(lid, bookId.parse(bookIdValue));
  touch(lid);
  revalidateList(lid);
  return { ok: true };
}

/** Save a full order. The ids must be exactly the list's current items, so this cannot add or drop books. */
export async function saveListOrder(listId: number, orderedBookIds: string[]): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const ids = z.array(bookId).max(500).parse(orderedBookIds);
  if (!ownedList(lid, user.id)) return { ok: false, error: "You can only edit your own lists" };
  const current = new Set((sqlite.prepare(`SELECT book_id id FROM list_items WHERE list_id = ?`).all(lid) as { id: string }[]).map((r) => r.id));
  if (current.size !== ids.length || new Set(ids).size !== ids.length || ids.some((i) => !current.has(i)))
    return { ok: false, error: "The list changed in another tab. Refresh and try again." };
  const upd = sqlite.prepare(`UPDATE list_items SET position = ? WHERE list_id = ? AND book_id = ?`);
  sqlite.transaction(() => ids.forEach((bid, i) => upd.run(i, lid, bid)))();
  touch(lid);
  revalidateList(lid);
  return { ok: true };
}

export async function setListItemNote(listId: number, bookIdValue: string, note: string): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const parsed = z.string().trim().max(280, "Keep notes under 280 characters").safeParse(note);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!ownedList(lid, user.id)) return { ok: false, error: "You can only edit your own lists" };
  sqlite.prepare(`UPDATE list_items SET note = ? WHERE list_id = ? AND book_id = ?`).run(parsed.data || null, lid, bookId.parse(bookIdValue));
  touch(lid);
  revalidateList(lid);
  return { ok: true };
}

/* ───────────── Likes ───────────── */

export async function toggleListLike(listId: number): Promise<({ ok: true; liked: boolean; likeCount: number }) | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const list = sqlite.prepare(`SELECT user_id AS userId, is_public AS isPublic FROM lists WHERE id = ?`).get(lid) as { userId: number; isPublic: number } | undefined;
  if (!list || (!list.isPublic && list.userId !== user.id)) return { ok: false, error: "List not found" };
  const liked = !!sqlite.prepare(`SELECT 1 FROM list_likes WHERE list_id = ? AND user_id = ?`).get(lid, user.id);
  sqlite.transaction(() => {
    if (liked) sqlite.prepare(`DELETE FROM list_likes WHERE list_id = ? AND user_id = ?`).run(lid, user.id);
    else sqlite.prepare(`INSERT INTO list_likes (list_id, user_id) VALUES (?,?)`).run(lid, user.id);
    sqlite.prepare(`UPDATE lists SET like_count = (SELECT count(*) FROM list_likes WHERE list_id = ?) WHERE id = ?`).run(lid, lid);
  })();
  const likeCount = (sqlite.prepare(`SELECT like_count n FROM lists WHERE id = ?`).get(lid) as { n: number }).n;
  revalidatePath(`/list/${lid}`);
  revalidatePath("/lists");
  return { ok: true, liked: !liked, likeCount };
}

/* ───────────── AddToListButton data ───────────── */

export async function getMyListsForBook(bookIdValue: string): Promise<{ signedIn: false } | { signedIn: true; lists: ReturnType<typeof getMyListsWithBook> }> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false };
  return { signedIn: true, lists: getMyListsWithBook(user.id, bookId.parse(bookIdValue)) };
}
