/** Shared loading placeholder for account, list and community pages. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="page py-10 md:py-14" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-4 h-10 w-2/3 max-w-md" />
      <div className="skeleton mt-3 h-4 w-1/2 max-w-sm" />
      <div className="mt-10 grid gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4">
            <div className="skeleton h-[84px] w-[56px] shrink-0" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
