"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createListQuick, getMyListsForBook, toggleBookInList } from "@/app/actions/lists";

type Row = { id: number; title: string; isPublic: boolean; included: boolean };

/**
 * CONTRACT: <AddToListButton bookId title /> – opens a popover to add the book to one of the user's lists
 * (or create a new list). Anonymous users go to /signin?next=… and come back here.
 */
export function AddToListButton({ bookId, title, className = "" }: { bookId: string; title: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const onOpen = async () => {
    if (open) return setOpen(false);
    setError(null);
    if (rows) return setOpen(true);
    setLoading(true);
    const d = await getMyListsForBook(bookId);
    setLoading(false);
    if (!d.signedIn) return router.push(`/signin?next=${encodeURIComponent(pathname)}`);
    setRows(d.lists);
    setOpen(true);
  };

  const toggle = async (row: Row) => {
    setBusy(row.id);
    setError(null);
    const r = await toggleBookInList(row.id, bookId);
    setBusy(null);
    if (!r.ok) return r.error === "auth" ? router.push(`/signin?next=${encodeURIComponent(pathname)}`) : setError(r.error);
    setRows((rs) => rs?.map((x) => (x.id === row.id ? { ...x, included: r.included } : x)) ?? rs);
    router.refresh();
  };

  const create = async () => {
    if (newTitle.trim().length < 2) return setError("Give the list a title of at least 2 characters");
    setBusy("new");
    setError(null);
    const r = await createListQuick({ title: newTitle, bookId });
    setBusy(null);
    if (!r.ok) return r.error === "auth" ? router.push(`/signin?next=${encodeURIComponent(pathname)}`) : setError(r.error);
    setRows((rs) => [{ id: r.id, title: r.title, isPublic: true, included: r.included }, ...(rs ?? [])]);
    setNewTitle("");
    router.refresh();
  };

  return (
    <div ref={root} className={`relative inline-block ${className}`}>
      <button type="button" onClick={onOpen} aria-expanded={open} aria-haspopup="dialog" aria-label={`Add ${title} to a list`}
        className="btn btn-outline h-10 px-4 text-[13px]">
        {loading ? "…" : "+ Add to list"}
      </button>

      {open && rows && (
        <div role="dialog" aria-label={`Add ${title} to a list`}
          className="absolute left-0 top-[calc(100%+6px)] z-[60] w-[min(20rem,calc(100vw-32px))] border border-hair bg-sheet text-[14px] text-ink shadow-card">
          <p className="lbl border-b border-hair px-4 py-3 text-muted">Your lists</p>
          {rows.length === 0 && <p className="px-4 py-3 text-muted">You don&apos;t have any lists yet.</p>}
          <ul className="max-h-64 overflow-y-auto py-1">
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" role="menuitemcheckbox" aria-checked={row.included} disabled={busy === row.id}
                  onClick={() => toggle(row)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-cobalt-soft hover:text-cobalt disabled:opacity-60">
                  <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center border ${row.included ? "border-cobalt bg-cobalt text-cobalt-ink" : "border-rule"}`}>
                    {row.included && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  {!row.isPublic && <span className="lbl text-[9px] text-muted">Private</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-hair p-4">
            <label htmlFor={`newlist-${bookId}`} className="lbl text-muted">Create new list</label>
            <div className="mt-2 flex gap-2">
              <input id={`newlist-${bookId}`} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={120}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
                placeholder="List title" className="field h-9 min-w-0 flex-1 py-0 text-[13.5px]" />
              <button type="button" onClick={create} disabled={busy === "new"} className="btn btn-primary btn-sm shrink-0 disabled:opacity-60">Create</button>
            </div>
          </div>
          {error && <p role="alert" className="border-t border-hair px-4 py-2 text-[13px] text-vermilion">{error}</p>}
        </div>
      )}
    </div>
  );
}
