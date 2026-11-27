import Link from "next/link";
import { listHref, type ListState, type SortKey } from "./params";

/** "Ratings breakdown" side panel: 1–10 bars; clicking a bar filters the list to that score. */
export function RatingsPanel({ hist, state, path, defaultSort }: { hist: { score: number; count: number }[]; state: ListState; path: string; defaultSort: SortKey }) {
  const max = Math.max(1, ...hist.map((h) => h.count));
  const total = hist.reduce((s, h) => s + h.count, 0);
  const mean = total ? hist.reduce((s, h) => s + h.score * h.count, 0) / total : null;
  return (
    <section className="border border-hair bg-card p-5" aria-labelledby="rb-h">
      <h2 id="rb-h" className="sec-title text-[18px]">Ratings breakdown</h2>
      <p className="mt-2 text-[13px] text-muted">{total ? `${total.toLocaleString("en-US")} ratings · average ${mean!.toFixed(1)}` : "No ratings yet"}</p>
      <ul className="mt-5 flex h-40 items-end gap-1.5" aria-label="Filter by your rating">
        {hist.map((h) => {
          const active = state.score === h.score;
          return (
            <li key={h.score} className="flex h-full min-w-0 flex-1">
              <Link href={listHref(path, state, { score: active ? null : h.score }, defaultSort)} scroll={false}
                aria-label={`${h.score} stars: ${h.count} ${h.count === 1 ? "rating" : "ratings"}${active ? " (filtered, click to clear)" : ""}`}
                className="group flex h-full w-full flex-col justify-end gap-1" aria-current={active || undefined}>
                <span className="text-center text-[11px] tabular-nums text-muted">{h.count || ""}</span>
                <span className="relative min-h-0 flex-1 bg-hair-2">
                  <span className={`absolute inset-x-0 bottom-0 rounded-t-[3px] transition-colors ${active ? "bg-cobalt" : state.score ? "bg-cobalt/35 group-hover:bg-cobalt/70" : "bg-cobalt/80 group-hover:bg-cobalt"}`}
                    style={{ height: `${h.count ? Math.max(4, (h.count / max) * 100) : 0}%` }} />
                </span>
                <span className={`text-center text-[12px] font-semibold ${active ? "text-cobalt" : "text-ink-2"}`}>{h.score}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] text-muted">{state.score ? <Link href={listHref(path, state, { score: null }, defaultSort)} scroll={false} className="font-semibold text-cobalt hover:underline">Show all ratings</Link> : "Click a bar to see the books you gave that score."}</p>
    </section>
  );
}
