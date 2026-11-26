"use client";

import { useState } from "react";
import { setShelf } from "@/app/actions/engagement";
import { useAuthAction } from "./useAuthAction";

type Status = "want" | "reading" | "read" | null;

/** Bookmark ribbon on the corner of a cover (IMDb's watchlist ribbon → "Want to Read"). */
export function ShelfRibbon({ bookId, status, title }: { bookId: string; status: Status; title: string }) {
  const [local, setLocal] = useState<Status>(status);
  const { run } = useAuthAction();
  const on = local !== null;
  return (
    <button
      type="button"
      aria-label={on ? `Remove ${title} from your Reading List` : `Add ${title} to Want to Read`}
      aria-pressed={on}
      title={on ? `On your list (${local === "want" ? "want to read" : local})` : "Add to Want to Read"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = on ? null : "want";
        setLocal(next);
        run(() => setShelf(bookId, next), undefined);
      }}
      className="group/rib absolute left-0 top-0 z-[2] h-[44px] w-[32px] focus-visible:outline-offset-0"
    >
      <svg viewBox="0 0 32 44" className="h-full w-full drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]" aria-hidden>
        <path d="M0 0h32v44l-16-8-16 8z" className={on ? "fill-cobalt" : "fill-[rgba(20,20,20,.62)] group-hover/rib:fill-[rgba(20,20,20,.8)]"} />
        {on ? (
          <path d="M9.5 17.5l4.5 4.5 8.5-9" fill="none" stroke="var(--cobalt-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M16 10v14M9 17h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
