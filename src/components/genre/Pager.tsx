import Link from "next/link";
import { hrefWith, type Params } from "./href";

/** Prev / next pagination driven by ?page=. */
export function Pager({ path, current, page, pages }: { path: string; current: Params; page: number; pages: number }) {
  if (pages <= 1) return null;
  const prev = page > 1 ? hrefWith(path, current, { page: page - 1 }) : null;
  const next = page < pages ? hrefWith(path, current, { page: page + 1 }) : null;
  const btn = "btn btn-outline btn-sm min-w-[96px]";
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-4 border-t border-hair pt-6">
      {prev ? <Link href={prev} rel="prev" className={btn}>← Previous</Link> : <span className={`${btn} pointer-events-none opacity-40`}>← Previous</span>}
      <p className="text-[13px] text-muted">Page {page.toLocaleString("en-US")} of {pages.toLocaleString("en-US")}</p>
      {next ? <Link href={next} rel="next" className={btn}>Next →</Link> : <span className={`${btn} pointer-events-none opacity-40`}>Next →</span>}
    </nav>
  );
}
