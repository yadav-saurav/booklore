export default function Loading() {
  return (
    <div className="page pb-16 pt-8 md:pt-12" aria-busy="true" aria-label="Loading author">
      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10 lg:grid-cols-[260px_1fr]">
        <div className="skeleton aspect-[3/4] w-[52%] max-w-[200px] md:w-full md:max-w-none" />
        <div>
          <div className="skeleton h-12 w-3/4 max-w-md" />
          <div className="skeleton mt-4 h-4 w-40" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="skeleton h-5 w-28" /><div className="skeleton h-5 w-28" /></div>
          <div className="mt-8 space-y-2.5"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-11/12" /><div className="skeleton h-4 w-9/12" /></div>
          <div className="mt-8 grid grid-cols-2 gap-px sm:grid-cols-4"><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /><div className="skeleton h-20" /></div>
        </div>
      </div>
      <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton aspect-[2/3]" />)}
      </div>
    </div>
  );
}
