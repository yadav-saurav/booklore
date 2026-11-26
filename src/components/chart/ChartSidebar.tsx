import Link from "next/link";
import { buildHref } from "./url";

/** IMDb's "More to explore" column: the other charts plus top-rated-by-genre shortcuts. */
export function ChartSidebar({ genres }: { genres: { slug: string; name: string }[] }) {
  return (
    <aside aria-label="More to explore" className="md:sticky md:top-20 md:self-start">
      <div className="border border-hair bg-sheet p-5">
        <p className="lbl mb-3 text-cobalt">More to explore</p>
        <ul className="divide-y divide-hair text-[15px]">
          <li><Link className="flex justify-between py-2.5 hover:text-cobalt" href="/chart/bookmeter">Most Popular Books <span aria-hidden>→</span></Link></li>
          <li><Link className="flex justify-between py-2.5 hover:text-cobalt" href="/chart/new">New &amp; Notable <span aria-hidden>→</span></Link></li>
          <li><Link className="flex justify-between py-2.5 hover:text-cobalt" href="/chart/top">BOOKLORE Top 250 <span aria-hidden>→</span></Link></li>
          <li><Link className="flex justify-between py-2.5 hover:text-cobalt" href="/search/advanced">Advanced title search <span aria-hidden>→</span></Link></li>
        </ul>
      </div>
      <div className="mt-6">
        <p className="lbl mb-3 text-muted">Top rated by genre</p>
        <ul className="flex flex-wrap gap-1.5">
          {genres.slice(0, 12).map((g) => (
            <li key={g.slug}>
              <Link className="chip" href={buildHref("/chart/top", { genre: g.slug })}>{g.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
