/** Loading state matching the list header band, toolbar and detailed rows. */
export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading list">
      <div className="border-b border-hair bg-sheet">
        <div className="page py-7 md:py-9">
          <div className="skeleton h-3 w-44" />
          <div className="skeleton mt-4 h-10 w-72 max-w-full" />
          <div className="mt-4 flex gap-3"><div className="skeleton h-6 w-6 rounded-full" /><div className="skeleton h-6 w-56" /></div>
        </div>
      </div>
      <div className="page">
        <div className="flex justify-between border-b border-hair py-4"><div className="skeleton h-5 w-24" /><div className="skeleton h-8 w-72 max-w-[55%]" /></div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-5 border-b border-hair py-5">
            <div className="skeleton aspect-[2/3] w-[64px] shrink-0 sm:w-[70px]" />
            <div className="flex-1 space-y-2.5"><div className="skeleton h-5 w-2/3" /><div className="skeleton h-3.5 w-1/3" /><div className="skeleton h-3.5 w-40" /><div className="skeleton h-3.5 w-full max-w-xl" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
