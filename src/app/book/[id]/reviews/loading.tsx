export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading reviews">
      <div className="border-b border-hair bg-sheet">
        <div className="page flex items-end gap-5 py-8">
          <div className="skeleton aspect-[2/3] w-[64px] md:w-[76px]" />
          <div className="flex-1"><div className="skeleton h-4 w-48" /><div className="skeleton mt-3 h-9 w-64" /></div>
        </div>
      </div>
      <div className="page grid gap-12 pt-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex gap-3 border-b border-hair pb-5"><div className="skeleton h-10 w-[200px]" /><div className="skeleton h-10 w-[150px]" /></div>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton mt-5 h-52 w-full" />)}
        </div>
        <div className="skeleton hidden h-96 lg:block" />
      </div>
    </div>
  );
}
