/** "How is this ranked?" popover. Native details/summary, so it works without JavaScript. */
export function RankingExplainer({ minVotes, mean }: { minVotes: number; mean: number }) {
  return (
    <details className="group relative">
      <summary className="box cursor-pointer list-none text-cobalt hover:bg-cobalt-soft [&::-webkit-details-marker]:hidden">
        How is this ranked?
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 w-[min(88vw,380px)] border border-rule bg-sheet p-4 text-[14px] leading-relaxed text-ink-2 shadow-card">
        <p className="lbl mb-2 text-cobalt">Weighted rating</p>
        <p>
          Each title gets a weighted score so a book with a few enthusiastic votes can&rsquo;t outrank a well-loved one with
          thousands. The score pulls a title toward the catalog average until it has enough ratings.
        </p>
        <p className="mt-3 font-mono text-[12.5px] text-ink">WR = (v ÷ (v + m)) × R + (m ÷ (v + m)) × C</p>
        <ul className="mt-3 space-y-1 text-[13px]">
          <li><span className="font-semibold text-ink">R</span> the book&rsquo;s mean rating</li>
          <li><span className="font-semibold text-ink">v</span> its number of ratings</li>
          <li><span className="font-semibold text-ink">m</span> minimum ratings to qualify: {minVotes}</li>
          <li><span className="font-semibold text-ink">C</span> the catalog mean: {mean.toFixed(1)}</li>
        </ul>
        <p className="mt-3 text-[13px] text-muted">Only titles with at least {minVotes} ratings are eligible. Up to 250 are listed.</p>
      </div>
    </details>
  );
}
