export default function Loading() {
  return (
    <div className="page pb-16 pt-8 md:pt-12" aria-busy="true" aria-label="Loading authors">
      <div className="skeleton h-8 w-64" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hair pb-4">
            <div className="skeleton h-4 w-8" />
            <div className="skeleton h-16 w-12" />
            <div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-3 w-1/2" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
