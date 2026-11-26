/** IMDb-style stat strip: four figures separated by hairlines. */
export function StatStrip({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="grid grid-cols-2 border-y border-hair sm:grid-cols-4">
      {items.map((s, i) => (
        <div key={s.label} className={`px-4 py-4 sm:px-6 ${i % 2 === 1 ? "border-l border-hair sm:border-l" : ""} ${i > 0 ? "sm:border-l sm:border-hair" : ""} ${i > 1 ? "border-t border-hair sm:border-t-0" : ""}`}>
          <dt className="lbl text-muted">{s.label}</dt>
          <dd className="mt-1.5 text-2xl font-semibold tabular-nums">{s.value.toLocaleString("en-US")}</dd>
        </div>
      ))}
    </dl>
  );
}
