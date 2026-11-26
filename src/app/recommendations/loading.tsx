export default function Loading() {
  return (
    <div className="page pb-16" aria-busy="true" aria-label="Loading your picks">
      <div className="border-b border-hair py-10 md:py-14">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton mt-4 h-12 w-72 max-w-full" />
        <div className="skeleton mt-5 h-4 w-[36rem] max-w-full" />
        <div className="skeleton mt-2 h-4 w-[28rem] max-w-full" />
      </div>
      <div className="py-7">
        <div className="skeleton mb-5 h-7 w-48" />
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <div className="skeleton h-8 w-full" />
              <div className="skeleton mt-2 aspect-[2/3] w-full" />
              <div className="skeleton mt-2 h-4 w-3/4" />
              <div className="skeleton mt-1.5 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
