import Link from "next/link";

type ParamInput = Record<string, string | number | boolean | null | undefined> | [string, string][];

/** Numbered pager driven by the `page` URL param. Keeps every other param (filters, sort, repeated genres) intact. */
export function Pagination({ page, pageSize, total, basePath, params = {}, label = "Results pages" }: {
  page: number; pageSize: number; total: number; basePath: string; params?: ParamInput; label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    const entries: [string, string][] = Array.isArray(params)
      ? params
      : Object.entries(params).flatMap(([k, v]) => (v === null || v === undefined || v === "" || v === false ? [] : [[k, v === true ? "1" : String(v)]]));
    for (const [k, v] of entries) if (k !== "page") sp.append(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const shown = new Set<number>([1, pages, page, page - 1, page + 1, page - 2, page + 2].filter((n) => n >= 1 && n <= pages));
  const nums = [...shown].sort((a, b) => a - b);
  const btn = "inline-flex h-9 min-w-9 items-center justify-center border border-hair px-2.5 text-[13px] font-semibold tabular-nums hover:border-cobalt hover:text-cobalt";
  return (
    <nav aria-label={label} className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? <Link href={href(page - 1)} rel="prev" className={btn}>← Prev</Link> : <span className={`${btn} opacity-40`} aria-disabled="true">← Prev</span>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && nums[i - 1] !== n - 1 && <span className="px-1 text-muted" aria-hidden>…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined}
            className={`${btn} ${n === page ? "border-cobalt bg-cobalt text-cobalt-ink" : ""}`}>{n}</Link>
        </span>
      ))}
      {page < pages ? <Link href={href(page + 1)} rel="next" className={btn}>Next →</Link> : <span className={`${btn} opacity-40`} aria-disabled="true">Next →</span>}
    </nav>
  );
}
