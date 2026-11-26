import { compact, fmtRating } from "@/lib/util";

export function StarIcon({ className = "h-4 w-4", filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.6}>
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" strokeLinejoin="round" />
    </svg>
  );
}

/** "★ 8.7 (12K)" – IMDb's compact aggregate rating. */
export function RatingInline({ avg, count, size = "sm" }: { avg: number | null; count?: number; size?: "sm" | "md" }) {
  const big = size === "md";
  return (
    <span className={`inline-flex items-center gap-1 ${big ? "text-base" : "text-[13px]"} text-ink-2`}>
      <StarIcon className={`${big ? "h-5 w-5" : "h-3.5 w-3.5"} text-star`} />
      <span className="font-semibold text-ink">{fmtRating(avg)}</span>
      {count !== undefined && count > 0 && <span className="text-muted">({compact(count)})</span>}
    </span>
  );
}

/** Popularity movement arrow (BookMeter). */
export function RankDelta({ rank, prev }: { rank: number | null; prev: number | null }) {
  if (!rank || !prev || rank === prev)
    return <span className="text-[12px] text-muted" aria-label="no change">—</span>;
  const up = rank < prev;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${up ? "text-up" : "text-down"}`}>
      <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 ${up ? "" : "rotate-180"}`} aria-hidden>
        <path d="M5 1 9 7H1z" fill="currentColor" />
      </svg>
      {Math.abs(prev - rank)}
    </span>
  );
}
