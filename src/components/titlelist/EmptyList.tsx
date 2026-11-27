import Link from "next/link";

/** Big-ribbon empty state (IMDb's empty Watchlist). */
export function EmptyList({ title, body, filtered, clearHref, actions = true }: { title: string; body: string; filtered?: boolean; clearHref?: string; actions?: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <svg viewBox="0 0 64 88" className="h-24 w-[70px] text-cobalt" aria-hidden>
        <path d="M0 0h64v88L32 72 0 88z" fill="currentColor" opacity=".12" />
        <path d="M0 0h64v88L32 72 0 88z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M32 26v28M18 40h28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h2 className="mt-6 text-[22px] font-semibold tracking-tight">{filtered ? "No titles match these filters" : title}</h2>
      <p className="mt-2 max-w-md text-[15px] text-muted">{filtered ? "Try removing a filter to see more of this list." : body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {filtered && clearHref ? <Link href={clearHref} className="btn btn-outline">Clear filters</Link> : actions && (
          <>
            <Link href="/chart/top" className="btn btn-primary">Browse charts</Link>
            <Link href="/recommendations" className="btn btn-outline">Recommendations</Link>
          </>
        )}
      </div>
    </div>
  );
}
