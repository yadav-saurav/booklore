export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading ratings">
      <div className="border-b border-hair bg-sheet">
        <div className="page flex items-end gap-5 py-8">
          <div className="skeleton aspect-[2/3] w-[64px] md:w-[76px]" />
          <div className="flex-1"><div className="skeleton h-4 w-48" /><div className="skeleton mt-3 h-9 w-40" /></div>
        </div>
      </div>
      <div className="page pt-8">
        <div className="grid gap-4 sm:grid-cols-2"><div className="skeleton h-36" /><div className="skeleton h-36" /></div>
        <div className="mt-10 space-y-3">{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton h-3" style={{ width: `${90 - i * 7}%` }} />)}</div>
      </div>
    </div>
  );
}
