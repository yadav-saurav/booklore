export default function Loading() {
  return (
    <div className="page pb-16 pt-8 md:pt-12" aria-busy="true" aria-label="Loading genres">
      <div className="skeleton h-8 w-40" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-[220px]" />)}
      </div>
    </div>
  );
}
