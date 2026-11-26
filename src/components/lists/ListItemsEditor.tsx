"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removeBookFromList, saveListOrder, setListItemNote } from "@/app/actions/lists";
import { BookCover } from "@/components/book/BookCover";
import { BookSearchAdd } from "./BookSearchAdd";

export type EditorItem = {
  id: string; title: string; authorName: string | null; year: number | null; coverId: number | null; coverUrl: string | null;
  pages: number | null; note: string | null;
};

/**
 * Numbered items with reorder (buttons and drag and drop), per-item notes, remove, and search-to-add.
 * Every mutation is a server action that re-checks ownership and the list's current membership.
 */
export function ListItemsEditor({ listId, initialItems }: { listId: number; initialItems: EditorItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => setItems(initialItems), [initialItems]);

  const fail = (msg: string) => { setError(msg); router.refresh(); };

  const persist = (next: EditorItem[]) => {
    setItems(next);
    setError(null);
    start(async () => {
      const r = await saveListOrder(listId, next.map((i) => i.id));
      if (!r.ok) fail(r.error);
    });
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    persist(next);
  };

  const remove = (id: string) => {
    setError(null);
    start(async () => {
      const r = await removeBookFromList(listId, id);
      if (!r.ok) return fail(r.error);
      setItems((xs) => xs.filter((x) => x.id !== id));
      router.refresh();
    });
  };

  const saveNote = (id: string) => {
    start(async () => {
      const r = await setListItemNote(listId, id, noteDraft);
      if (!r.ok) return fail(r.error);
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, note: noteDraft.trim() || null } : x)));
      setNoteFor(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="items-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="items-h" className="lbl text-cobalt">Titles <span className="text-muted">({items.length})</span></h2>
          {pending && <span className="text-[12.5px] text-muted" role="status">Saving…</span>}
        </div>
        {error && <p role="alert" className="mb-3 text-[13px] text-vermilion">{error}</p>}

        {items.length === 0 ? (
          <p className="border border-dashed border-hair px-5 py-8 text-center text-[15px] text-muted">
            No titles yet. Search above to add the first one.
          </p>
        ) : (
          <ol className="border-y border-hair">
            {items.map((it, i) => (
              <li key={it.id}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); }}
                onDragEnd={() => setDragFrom(null)}
                className={`flex gap-3 border-t border-hair py-3 first:border-t-0 ${dragFrom === i ? "opacity-50" : ""}`}>
                <span className="w-7 shrink-0 pt-1 text-right text-lg font-light tabular-nums text-muted" aria-hidden>{i + 1}</span>
                <div className="w-[44px] shrink-0">
                  <BookCover book={it} size="S" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-snug">{it.title}</p>
                  <p className="truncate text-[12.5px] text-muted">{[it.authorName, it.year].filter(Boolean).join(" · ") || "—"}</p>
                  {noteFor === it.id ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <label htmlFor={`note-${i}`} className="sr-only">Note for {it.title}</label>
                      <textarea id={`note-${i}`} rows={2} maxLength={280} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} className="field text-[14px]" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveNote(it.id)} disabled={pending} className="btn btn-primary btn-sm">Save note</button>
                        <button type="button" onClick={() => setNoteFor(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                    </div>
                  ) : it.note ? (
                    <p className="prose-serif mt-1.5 text-[15px] italic text-ink-2">“{it.note}”</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                  <button type="button" aria-label={`Move ${it.title} up`} disabled={i === 0 || pending} onClick={() => move(i, i - 1)}
                    className="btn btn-ghost btn-sm px-2" title="Move up">↑</button>
                  <button type="button" aria-label={`Move ${it.title} down`} disabled={i === items.length - 1 || pending} onClick={() => move(i, i + 1)}
                    className="btn btn-ghost btn-sm px-2" title="Move down">↓</button>
                  <button type="button" onClick={() => { setNoteFor(it.id); setNoteDraft(it.note ?? ""); }} className="btn btn-ghost btn-sm">
                    {it.note ? "Edit note" : "Add note"}
                  </button>
                  <button type="button" onClick={() => remove(it.id)} disabled={pending} className="btn btn-ghost btn-sm text-down">Remove</button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {items.length > 1 && <p className="mt-2 text-[12.5px] text-muted">Tip: drag a row to reorder, or use the arrows.</p>}
      </section>

      <section aria-labelledby="add-h" className="border border-hair bg-sheet p-5">
        <h2 id="add-h" className="lbl mb-4 text-cobalt">Add titles</h2>
        <BookSearchAdd listId={listId} />
      </section>
    </div>
  );
}
