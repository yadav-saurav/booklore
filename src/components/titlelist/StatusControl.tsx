"use client";

import { useEffect, useState } from "react";
import { setShelf } from "@/app/actions/engagement";
import { useAuthAction } from "@/components/book/useAuthAction";
import type { ShelfStatus } from "@/db/schema";

const NEXT: Record<ShelfStatus, ShelfStatus> = { want: "reading", reading: "read", read: "want" };
const LABEL: Record<ShelfStatus, string> = { want: "Want to Read", reading: "Reading", read: "Read" };

function Eye({ s }: { s: ShelfStatus }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" strokeLinejoin="round" fill={s === "read" ? "currentColor" : "none"} fillOpacity={s === "read" ? 0.14 : 0} />
      {s === "want" && <circle cx="12" cy="12" r="2.8" />}
      {s === "reading" && <path d="M12 9.2a2.8 2.8 0 1 1 0 5.6" fill="currentColor" stroke="none" />}
      {s === "reading" && <circle cx="12" cy="12" r="2.8" />}
      {s === "read" && <path d="M8.5 12.2l2.3 2.3 4.7-4.9" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** IMDb's "Watched" toggle, for reading status: cycles Want → Reading → Read; × removes from the Reading List. */
export function StatusControl({ bookId, title, status, compact = false }: { bookId: string; title: string; status: ShelfStatus; compact?: boolean }) {
  const [local, setLocal] = useState<ShelfStatus | null>(status);
  const { run, pending } = useAuthAction();
  useEffect(() => setLocal(status), [status]);
  const apply = (next: ShelfStatus | null) => {
    const prev = local;
    setLocal(next);
    run(async () => { const r = await setShelf(bookId, next); if (!r.ok) setLocal(prev); return r; });
  };
  if (!local) return <span className="text-[12px] text-muted">Removed</span>;
  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      <button type="button" onClick={() => apply(NEXT[local])}
        aria-label={`Status: ${LABEL[local]}. Change to ${LABEL[NEXT[local]]} for ${title}`} title={`Mark as ${LABEL[NEXT[local]]}`}
        className={`inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] font-semibold transition-colors hover:bg-cobalt-soft ${local === "read" ? "text-cobalt" : local === "reading" ? "text-up" : "text-ink-2"}`}>
        <Eye s={local} />
        {!compact && <span className="whitespace-nowrap">{LABEL[local]}</span>}
      </button>
      <button type="button" onClick={() => apply(null)} aria-label={`Remove ${title} from your Reading List`} title="Remove"
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-hair-2 hover:text-down">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

export function StatusBadge({ status }: { status: ShelfStatus }) {
  const tone = status === "read" ? "border-cobalt/40 text-cobalt" : status === "reading" ? "border-up/50 text-up" : "border-hair text-ink-2";
  return <span className={`lbl inline-flex h-[20px] items-center border px-1.5 ${tone}`}>{LABEL[status]}</span>;
}
