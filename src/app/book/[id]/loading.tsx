export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading book">
      <div className="border-b border-hair bg-sheet">
        <div className="page pb-10 pt-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row">
            <div className="flex-1">
              <div className="skeleton h-10 w-3/4 max-w-xl md:h-12" />
              <div className="skeleton mt-3 h-4 w-64" />
            </div>
            <div className="skeleton h-14 w-full max-w-[340px]" />
          </div>
          <div className="mt-6 grid gap-2 md:h-[330px] md:grid-cols-[220px_1fr] lg:h-[372px] lg:grid-cols-[248px_1fr_200px]">
            <div className="skeleton aspect-[2/3] w-[112px] md:h-full md:w-auto" />
            <div className="skeleton hidden h-full md:block" />
            <div className="hidden flex-col gap-2 lg:flex"><div className="skeleton flex-1" /><div className="skeleton flex-1" /></div>
          </div>
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px]">
            <div className="space-y-3">
              <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[30px] w-24 rounded-full" />)}</div>
              <div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-11/12" /><div className="skeleton h-4 w-2/3" />
              <div className="skeleton mt-4 h-11 w-full" /><div className="skeleton h-11 w-full" />
            </div>
            <div className="space-y-3"><div className="skeleton h-12 w-full" /><div className="skeleton h-11 w-full" /><div className="skeleton h-28 w-full" /></div>
          </div>
        </div>
      </div>
      <div className="page pt-10">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton mt-5 h-48 w-full max-w-[860px]" />
      </div>
    </div>
  );
}
