export default function Loading() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading search results" className="page pb-16">
      <div className="max-w-2xl pt-6">
        <div className="skeleton h-10 w-full" />
      </div>
      <div className="mt-6 border-b border-hair pb-4">
        <div className="skeleton h-8 w-80 max-w-full" />
        <div className="mt-4 flex gap-2">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-[30px] w-20 rounded-full" />)}
        </div>
      </div>
      <ul className="mt-6 divide-y divide-hair">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex gap-3.5 py-4">
            <div className="skeleton h-[90px] w-[60px] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/5" />
              <div className="skeleton h-3 w-3/5" />
              <div className="skeleton h-3 w-1/4" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
