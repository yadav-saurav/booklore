"use client";

import { useEffect, useRef, useState } from "react";
import { setShelf } from "@/app/actions/engagement";
import { useAuthAction } from "@/components/book/useAuthAction";
import { compact } from "@/lib/util";

type Status = "want" | "reading" | "read" | null;
const LABEL: Record<Exclude<Status, null>, string> = { want: "Want to Read", reading: "Currently Reading", read: "Read" };

/** IMDb's "+ Add to Watchlist" split button → Reading List, with a status dropdown. */
export function ShelfButton({ bookId, title, status, addedBy }: { bookId: string; title: string; status: Status; addedBy: number }) {
  const [local, setLocal] = useState<Status>(status);
  const [open, setOpen] = useState(false);
  const { run, pending } = useAuthAction();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setLocal(status), [status]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const choose = (next: Status) => {
    const prev = local;
    setLocal(next);
    setOpen(false);
    run(async () => {
      const r = await setShelf(bookId, next);
      if (!r.ok) setLocal(prev);
      return r;
    });
  };

  const on = local !== null;
  return (
    <div ref={wrap} className="relative">
      <div className={`flex h-12 w-full ${on ? "bg-cobalt-soft text-cobalt ring-1 ring-inset ring-cobalt" : "bg-cobalt text-cobalt-ink"}`}>
        <button type="button" disabled={pending} onClick={() => (on ? setOpen((v) => !v) : choose("want"))}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 text-left transition-[filter] hover:brightness-110 disabled:cursor-wait"
          aria-label={on ? `${title} is on your Reading List as ${LABEL[local!]}. Change status` : `Add ${title} to your Reading List`}>
          {on ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[14px] font-semibold">{on ? `On Reading List · ${LABEL[local!]}` : "Add to Reading List"}</span>
            <span className={`block text-[12px] ${on ? "text-cobalt/80" : "opacity-80"}`}>Added by {compact(addedBy)} {addedBy === 1 ? "reader" : "readers"}</span>
          </span>
        </button>
        <span className={`my-2 w-px ${on ? "bg-cobalt/40" : "bg-cobalt-ink/30"}`} aria-hidden />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Choose reading status"
          className="flex w-12 shrink-0 items-center justify-center transition-[filter] hover:brightness-110">
          <svg viewBox="0 0 12 8" className={`h-2 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        </button>
      </div>
      {open && (
        <div role="menu" aria-label="Reading status" className="absolute inset-x-0 top-full z-30 mt-1 border border-hair bg-sheet py-1.5 shadow-card">
          <p className="lbl px-4 pb-2 pt-1.5 text-muted">Reading status</p>
          {(Object.keys(LABEL) as Exclude<Status, null>[]).map((k) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={local === k} onClick={() => choose(k)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-cobalt-soft focus-visible:bg-cobalt-soft">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${local === k ? "border-cobalt bg-cobalt" : "border-muted"}`} aria-hidden>
                {local === k && <span className="h-1.5 w-1.5 rounded-full bg-cobalt-ink" />}
              </span>
              <span className={local === k ? "font-semibold text-cobalt" : ""}>{LABEL[k]}</span>
            </button>
          ))}
          {on && (
            <>
              <div className="my-1.5 h-px bg-hair" />
              <button type="button" role="menuitem" onClick={() => choose(null)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-down hover:bg-hair-2">
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                Remove from Reading List
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
