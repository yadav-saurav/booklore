/** Placeholder for chart pages while the list streams in. Uses the shared .skeleton shimmer. */
export function ChartSkeleton({ rows = 10, grid = false }: { rows?: number; grid?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading chart" role="status" className="page pb-16">
      <div className="pb-5 pt-7">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-3 h-9 w-72 max-w-full" />
        <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[30px] w-20 rounded-full" />)}
      </div>
      {grid ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton aspect-[2/3]" />)}
        </div>
      ) : (
        <ul className="divide-y divide-hair">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-center gap-4 py-4">
              <div className="skeleton h-4 w-10" />
              <div className="skeleton h-[78px] w-[52px] shrink-0 md:h-[96px] md:w-[64px]" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/5" />
                <div className="skeleton h-3 w-2/5" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
