"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const SORTS = [
  ["helpful", "Helpfulness"],
  ["date", "Review date"],
  ["rating-high", "Rating: high to low"],
  ["rating-low", "Rating: low to high"],
] as const;

/** Sort / rating filter / hide-spoilers controls; state lives in the URL so results are shareable. */
export function ReviewsToolbar({ sort, rating, hideSpoilers, ratingCounts }: {
  sort: string; rating: number | null; hideSpoilers: boolean; ratingCounts: Record<number, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v === null || v === "") p.delete(k); else p.set(k, v);
    p.delete("page");
    p.delete("write");
    start(() => router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };

  return (
    <div className={`flex flex-wrap items-end gap-3 transition-[filter] ${pending ? "grayscale" : ""}`} aria-busy={pending}>
      <label className="flex flex-col gap-1.5">
        <span className="lbl text-muted">Sort by</span>
        <select className="field h-10 w-[200px] cursor-pointer pr-8" value={sort} onChange={(e) => set("sort", e.target.value === "helpful" ? null : e.target.value)}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="lbl text-muted">Rating</span>
        <select className="field h-10 w-[150px] cursor-pointer" value={rating ?? ""} onChange={(e) => set("rating", e.target.value || null)}>
          <option value="">All ratings</option>
          {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
            <option key={n} value={n}>{n} star{n > 1 ? "s" : ""} ({ratingCounts[n] ?? 0})</option>
          ))}
        </select>
      </label>
      <label className="flex h-10 cursor-pointer items-center gap-2.5 px-1 text-[14px] font-medium">
        <span className="relative inline-flex">
          <input type="checkbox" role="switch" checked={hideSpoilers} onChange={(e) => set("spoilers", e.target.checked ? "hide" : null)} className="peer sr-only" />
          <span className="h-5 w-9 rounded-full bg-hair transition-colors peer-checked:bg-cobalt peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cobalt" />
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-sheet shadow transition-transform peer-checked:translate-x-4" />
        </span>
        Hide spoilers
      </label>
    </div>
  );
}
