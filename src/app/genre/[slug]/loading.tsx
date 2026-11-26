export default function Loading() {
  return (
    <div className="pb-16" aria-busy="true" aria-label="Loading genre">
      <div className="border-b border-hair">
        <div className="page py-12 md:py-14">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton mt-4 h-14 w-2/3 max-w-md" />
          <div className="skeleton mt-5 h-4 w-full max-w-xl" />
        </div>
      </div>
      <div className="page mt-12">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton aspect-[2/3]" />)}
        </div>
      </div>
    </div>
  );
}
