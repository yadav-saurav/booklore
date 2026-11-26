"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateShelfProgress } from "@/app/readinglist/actions";

/** Inline "pages read" updater for Currently Reading, with a progress bar. */
export function ProgressForm({ bookId, progress, pages }: { bookId: string; progress: number | null; pages: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(String(progress ?? 0));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = Math.min(Number(progress ?? 0), pages ?? Infinity);
  const pct = pages ? Math.min(100, Math.round((shown / pages) * 100)) : null;

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      {pct !== null && (
        <div className="h-1.5 w-full bg-hair-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Reading progress">
          <div className="h-full bg-cobalt transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          start(async () => {
            const r = await updateShelfProgress(bookId, Number(value));
            if (r.ok) { setValue(String(r.progress)); router.refresh(); }
            else if (r.error === "auth") router.push("/signin?next=/readinglist");
            else setMsg(r.error);
          });
        }}
      >
        <label className="text-[13px] text-muted" htmlFor={`p-${bookId}`}>
          Pages read{pages ? ` of ${pages}` : ""}
        </label>
        <input id={`p-${bookId}`} type="number" inputMode="numeric" min={0} max={pages ?? undefined} step={1}
          value={value} onChange={(e) => setValue(e.target.value)}
          className="field h-9 w-24 py-0 text-[13.5px]" />
        <button type="submit" disabled={pending} className="btn btn-outline btn-sm disabled:opacity-60">
          {pending ? "Saving…" : "Update"}
        </button>
        {msg && <span role="alert" className="text-[12.5px] text-vermilion">{msg}</span>}
      </form>
    </div>
  );
}
