"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveExternalRef } from "@/lib/catalog";
import { getMyListsWithBook, type MyListRow } from "@/lib/queries/lists";

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
async function ownedList(listId: number, userId: number) {
  const row = await db.get<{ id: number; userId: number }>(`SELECT id, user_id AS userId FROM lists WHERE id = ?`, listId);
  return row && row.userId === userId ? row : null;
}

const touch = (listId: number) => db.run(`UPDATE lists SET updated_at = unixepoch() WHERE id = ?`, listId);

function revalidateList(listId: number) {
  revalidatePath(`/list/${listId}`);
  revalidatePath(`/list/${listId}/edit`);
  revalidatePath("/lists");
  revalidatePath("/user", "layout");
}

async function nextPosition(listId: number): Promise<number> {
  return ((await db.get<{ m: number | null }>(`SELECT max(position) AS m FROM list_items WHERE list_id = ?`, listId))?.m ?? -1) + 1;
}

/* ───────────── List metadata ───────────── */

export async function createList(_: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/list/new");
  const raw = readFields(form);
  const parsed = ListFields.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { title: raw.title, description: raw.description } };
  const r = await db.get<{ id: number }>(`INSERT INTO lists (user_id, title, description, is_public) VALUES (?,?,?,?) RETURNING id`,
    user.id, parsed.data.title, parsed.data.description, parsed.data.isPublic ? 1 : 0);
  revalidatePath("/lists");
  redirect(`/list/${r!.id}/edit`);
}

export async function updateList(listId: number, _: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to edit lists" };
  if (!(await ownedList(id.parse(listId), user.id))) return { error: "You can only edit your own lists" };
  const raw = readFields(form);
  const parsed = ListFields.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { title: raw.title, description: raw.description } };
  await db.run(`UPDATE lists SET title = ?, description = ?, is_public = ?, updated_at = unixepoch() WHERE id = ?`,
    parsed.data.title, parsed.data.description, parsed.data.isPublic ? 1 : 0, Number(listId));
  revalidateList(listId);
  return { saved: true };
}

export async function deleteList(listId: number): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!(await ownedList(id.parse(listId), user.id))) return { ok: false, error: "You can only delete your own lists" };
  await db.run(`DELETE FROM lists WHERE id = ?`, Number(listId));
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
  const r = await db.get<{ id: number }>(`INSERT INTO lists (user_id, title, description, is_public) VALUES (?,?,'',1) RETURNING id`, user.id, title.data);
  const listId = r!.id;
  let included = false;
  if (input.bookId) {
    const bid = bookId.safeParse(input.bookId);
    if (bid.success && (await db.get(`SELECT 1 FROM books WHERE id = ?`, bid.data))) {
      await db.run(`INSERT INTO list_items (list_id, book_id, position) VALUES (?,?,0)`, listId, bid.data);
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
  if (!(await ownedList(lid, user.id))) return { ok: false, error: "You can only edit your own lists" };
  const exists = await db.get(`SELECT 1 FROM list_items WHERE list_id = ? AND book_id = ?`, lid, bid);
  if (exists) {
    await db.run(`DELETE FROM list_items WHERE list_id = ? AND book_id = ?`, lid, bid);
  } else {
    if (!(await db.get(`SELECT 1 FROM books WHERE id = ?`, bid))) return { ok: false, error: "Book not found" };
    await db.run(`INSERT INTO list_items (list_id, book_id, position) VALUES (?,?,?)`, lid, bid, await nextPosition(lid));
  }
  await touch(lid);
  revalidateList(lid);
  return { ok: true, included: !exists };
}

/** Add a book by id (local slug). Used by the list editor's search. */
export async function addBookToList(listId: number, bookIdValue: string): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const bid = bookId.parse(bookIdValue);
  if (!(await ownedList(lid, user.id))) return { ok: false, error: "You can only edit your own lists" };
  if (!(await db.get(`SELECT 1 FROM books WHERE id = ?`, bid))) return { ok: false, error: "Book not found" };
  await db.run(`INSERT INTO list_items (list_id, book_id, position) VALUES (?,?,?) ON CONFLICT DO NOTHING`, lid, bid, await nextPosition(lid));
  await touch(lid);
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
  if (!(await ownedList(lid, user.id))) return { ok: false, error: "You can only edit your own lists" };
  const slug = await resolveExternalRef(parsedRef.data);
  if (!slug) return { ok: false, error: "Could not find that book" };
  await db.run(`INSERT INTO list_items (list_id, book_id, position) VALUES (?,?,?) ON CONFLICT DO NOTHING`, lid, slug, await nextPosition(lid));
  await touch(lid);
  revalidateList(lid);
  return { ok: true, bookId: slug };
}

export async function removeBookFromList(listId: number, bookIdValue: string): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  if (!(await ownedList(lid, user.id))) return { ok: false, error: "You can only edit your own lists" };
  await db.run(`DELETE FROM list_items WHERE list_id = ? AND book_id = ?`, lid, bookId.parse(bookIdValue));
  await touch(lid);
  revalidateList(lid);
  return { ok: true };
}

/** Save a full order. The ids must be exactly the list's current items, so this cannot add or drop books. */
export async function saveListOrder(listId: number, orderedBookIds: string[]): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const ids = z.array(bookId).max(500).parse(orderedBookIds);
  if (!(await ownedList(lid, user.id))) return { ok: false, error: "You can only edit your own lists" };
  const current = new Set((await db.all<{ id: string }>(`SELECT book_id AS id FROM list_items WHERE list_id = ?`, lid)).map((r) => r.id));
  if (current.size !== ids.length || new Set(ids).size !== ids.length || ids.some((i) => !current.has(i)))
    return { ok: false, error: "The list changed in another tab. Refresh and try again." };
  await db.tx(async (t) => {
    for (const [i, bid] of ids.entries()) await t.run(`UPDATE list_items SET position = ? WHERE list_id = ? AND book_id = ?`, i, lid, bid);
  });
  await touch(lid);
  revalidateList(lid);
  return { ok: true };
}

export async function setListItemNote(listId: number, bookIdValue: string, note: string): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const parsed = z.string().trim().max(280, "Keep notes under 280 characters").safeParse(note);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await ownedList(lid, user.id))) return { ok: false, error: "You can only edit your own lists" };
  await db.run(`UPDATE list_items SET note = ? WHERE list_id = ? AND book_id = ?`, parsed.data || null, lid, bookId.parse(bookIdValue));
  await touch(lid);
  revalidateList(lid);
  return { ok: true };
}

/* ───────────── Likes ───────────── */

export async function toggleListLike(listId: number): Promise<({ ok: true; liked: boolean; likeCount: number }) | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const lid = id.parse(listId);
  const list = await db.get<{ userId: number; isPublic: number }>(`SELECT user_id AS userId, is_public AS isPublic FROM lists WHERE id = ?`, lid);
  if (!list || (!list.isPublic && list.userId !== user.id)) return { ok: false, error: "List not found" };
  const liked = !!(await db.get(`SELECT 1 FROM list_likes WHERE list_id = ? AND user_id = ?`, lid, user.id));
  const likeCount = await db.tx(async (t) => {
    if (liked) await t.run(`DELETE FROM list_likes WHERE list_id = ? AND user_id = ?`, lid, user.id);
    else await t.run(`INSERT INTO list_likes (list_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING`, lid, user.id);
    const r = await t.get<{ n: number }>(`UPDATE lists SET like_count = (SELECT count(*) FROM list_likes WHERE list_id = ?) WHERE id = ? RETURNING like_count AS n`, lid, lid);
    return r!.n;
  });
  revalidatePath(`/list/${lid}`);
  revalidatePath("/lists");
  return { ok: true, liked: !liked, likeCount };
}

/* ───────────── AddToListButton data ───────────── */

export async function getMyListsForBook(bookIdValue: string): Promise<{ signedIn: false } | { signedIn: true; lists: MyListRow[] }> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false };
  return { signedIn: true, lists: await getMyListsWithBook(user.id, bookId.parse(bookIdValue)) };
}
