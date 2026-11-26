import Link from "next/link";
import { StarIcon } from "@/components/book/Rating";
import { compact } from "@/lib/util";

const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);
const fmtPct = (p: number) => (p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`);

/** IMDb ratings breakdown: ten horizontal bars, 10 at the top, with percentage and vote count. */
export function RatingHistogram({ counts, total, mine }: { counts: number[]; total: number; mine?: number | null }) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <ol className="flex flex-col gap-2.5" aria-label="Ratings distribution">
        {counts.map((n, i) => ({ n, score: i + 1 })).reverse().map(({ n, score }) => {
          const p = pct(n, total);
          const isMine = mine === score;
          return (
            <li key={score} className="group grid grid-cols-[44px_1fr_88px] items-center gap-3" title={`${score}/10: ${n.toLocaleString("en-US")} ratings (${fmtPct(p)})`}>
              <span className={`inline-flex items-center gap-1 text-[14px] font-semibold tabular-nums ${isMine ? "text-cobalt" : "text-ink"}`}>
                <StarIcon className="h-3.5 w-3.5 text-star" />
                {score}
              </span>
              <span className="relative h-3 bg-hair-2">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] bg-cobalt transition-[filter] group-hover:brightness-110"
                  style={{ width: `${(n / max) * 100}%`, minWidth: n ? 3 : 0 }}
                />
              </span>
              <span className="text-[13px] tabular-nums text-muted">
                <span className="font-semibold text-ink">{fmtPct(p)}</span> ({compact(n)})
              </span>
            </li>
          );
        })}
      </ol>
      <table className="sr-only">
        <caption>Ratings distribution</caption>
        <thead><tr><th>Score</th><th>Ratings</th><th>Share</th></tr></thead>
        <tbody>
          {counts.map((n, i) => (
            <tr key={i}><td>{i + 1}</td><td>{n}</td><td>{fmtPct(pct(n, total))}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact ten-column histogram for the title page; the whole thing links to the ratings page. */
export function MiniHistogram({ counts, total, href }: { counts: number[]; total: number; href: string }) {
  const max = Math.max(1, ...counts);
  return (
    <Link href={href} className="group block" aria-label="See the full ratings breakdown">
      <div className="flex h-20 items-end gap-[3px]" aria-hidden>
        {counts.map((n, i) => (
          <span key={i} className="flex h-full flex-1 flex-col justify-end" title={`${i + 1}/10: ${n} (${fmtPct(pct(n, total))})`}>
            <span className="block rounded-t-[4px] bg-cobalt/85 transition-colors group-hover:bg-cobalt" style={{ height: `${Math.max(n ? 4 : 1, (n / max) * 100)}%`, opacity: n ? 1 : 0.25 }} />
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t border-hair pt-1.5" aria-hidden>
        {counts.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[11px] tabular-nums text-muted">{i + 1}</span>
        ))}
      </div>
    </Link>
  );
}
