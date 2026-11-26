export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading advanced search" className="page pb-16 pt-6">
      <div className="skeleton h-9 w-72 max-w-full" />
      <div className="mt-8 grid gap-8 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="hidden space-y-4 md:block">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-12 w-full" />)}
        </div>
        <div className="space-y-4">
          <div className="skeleton h-6 w-48" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-3.5 border-b border-hair py-4">
              <div className="skeleton h-[90px] w-[60px] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/5" />
                <div className="skeleton h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
