import { compact } from "@/lib/util";

/** IMDb's rating distribution: ten vertical bars, 1 to 10, sized against the largest bucket. */
export function Histogram({ data, caption }: { data: { score: number; count: number }[]; caption?: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <figure className="w-full">
      <div className="flex h-36 items-end gap-1.5 sm:gap-2" role="img"
        aria-label={`Rating distribution: ${data.map((d) => `${d.score}: ${d.count}`).join(", ")}`}>
        {data.map((d) => {
          const pct = (d.count / max) * 100;
          return (
            <div key={d.score} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
              <span className="text-center text-[11px] tabular-nums text-muted">{d.count ? compact(d.count) : ""}</span>
              <div className="relative min-h-0 flex-1 bg-hair-2">
                <div className="absolute inset-x-0 bottom-0 bg-cobalt transition-[height] duration-700"
                  style={{ height: `${d.count ? Math.max(pct, 3) : 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2" aria-hidden>
        {data.map((d) => <span key={d.score} className="flex-1 text-center text-[12px] font-semibold text-ink-2">{d.score}</span>)}
      </div>
      <figcaption className="mt-3 text-[12.5px] text-muted">
        {caption ?? `${total.toLocaleString("en-US")} ratings`}
      </figcaption>
    </figure>
  );
}
