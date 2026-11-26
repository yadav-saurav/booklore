import type { AdvancedFilters } from "@/lib/queries/advanced";
import { ADV_SORT_LABELS, ADV_SORTS } from "@/lib/queries/advanced";

export const FORM_ID = "adv-form";

const LANGUAGES: [string, string][] = [
  ["en", "English"], ["fr", "French"], ["de", "German"], ["es", "Spanish"], ["it", "Italian"],
  ["pt", "Portuguese"], ["ru", "Russian"], ["ja", "Japanese"],
];

const input = "field h-10 w-full text-[14px]";
const label = "lbl mb-1.5 block text-ink-2";

/** Collapsible filter panel. Native <details> so it works without JavaScript. */
function Panel({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-hair py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <svg viewBox="0 0 12 8" className="h-2 w-3 text-muted transition-transform group-open:rotate-180" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M1 1.5l5 5 5-5" />
        </svg>
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

/**
 * The advanced-search form. A plain GET form: every filter is a URL param, so results can be shared
 * and the page works without JavaScript. The mobile sheet wrapper gives it a footer submit button.
 */
export function AdvancedForm({ f, genres, signedIn }: {
  f: AdvancedFilters;
  genres: { slug: string; name: string; count: number }[];
  signedIn: boolean;
}) {
  return (
    <form id={FORM_ID} action="/search/advanced" method="get" className="pb-4" role="search" aria-label="Advanced title search">
      <Panel title="Title and people">
        <div>
          <label className={label} htmlFor="f-title">Title contains</label>
          <input id="f-title" name="title" defaultValue={f.title} className={input} placeholder="e.g. Dune" maxLength={120} autoComplete="off" />
        </div>
        <div>
          <label className={label} htmlFor="f-author">Author contains</label>
          <input id="f-author" name="author" defaultValue={f.author} className={input} placeholder="e.g. Le Guin" maxLength={120} autoComplete="off" />
        </div>
      </Panel>

      <Panel title="Keywords and subjects" open={!!(f.keyword || f.subject)}>
        <div>
          <label className={label} htmlFor="f-kw">Keyword</label>
          <input id="f-kw" name="kw" defaultValue={f.keyword} className={input} placeholder="Any word in title, author or subjects" maxLength={120} autoComplete="off" />
          <p className="mt-1.5 text-[12.5px] text-muted">Matches whole words and word starts.</p>
        </div>
        <div>
          <label className={label} htmlFor="f-subject">Subject</label>
          <input id="f-subject" name="subject" defaultValue={f.subject} className={input} placeholder="e.g. Space colonies" maxLength={120} autoComplete="off" />
        </div>
      </Panel>

      <Panel title="Genres" open={f.genres.length > 0}>
        <p className="text-[13px] text-muted">Books must match every genre you select.</p>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <label
              key={g.slug}
              className="chip cursor-pointer has-[:checked]:border-cobalt has-[:checked]:bg-cobalt has-[:checked]:text-cobalt-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cobalt"
            >
              <input type="checkbox" name="genre" value={g.slug} defaultChecked={f.genres.includes(g.slug)} className="sr-only" />
              {g.name}
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Publication year">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="f-yf">From</label>
            <input id="f-yf" name="yearFrom" type="number" inputMode="numeric" min={0} max={3000} defaultValue={f.yearFrom ?? ""} className={input} placeholder="1900" />
          </div>
          <div>
            <label className={label} htmlFor="f-yt">To</label>
            <input id="f-yt" name="yearTo" type="number" inputMode="numeric" min={0} max={3000} defaultValue={f.yearTo ?? ""} className={input} placeholder="2026" />
          </div>
        </div>
      </Panel>

      <Panel title="BOOKLORE rating">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="f-rmin">Minimum</label>
            <input id="f-rmin" name="ratingMin" type="number" inputMode="decimal" step={0.1} min={1} max={10} defaultValue={f.ratingMin ?? ""} className={input} placeholder="1.0" />
          </div>
          <div>
            <label className={label} htmlFor="f-rmax">Maximum</label>
            <input id="f-rmax" name="ratingMax" type="number" inputMode="decimal" step={0.1} min={1} max={10} defaultValue={f.ratingMax ?? ""} className={input} placeholder="10.0" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="f-votes">Minimum number of ratings</label>
          <input id="f-votes" name="votesMin" type="number" inputMode="numeric" min={0} defaultValue={f.votesMin ?? ""} className={input} placeholder="25" />
        </div>
      </Panel>

      <Panel title="Page count" open={f.pagesMin != null || f.pagesMax != null}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="f-pmin">Minimum</label>
            <input id="f-pmin" name="pagesMin" type="number" inputMode="numeric" min={0} defaultValue={f.pagesMin ?? ""} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="f-pmax">Maximum</label>
            <input id="f-pmax" name="pagesMax" type="number" inputMode="numeric" min={0} defaultValue={f.pagesMax ?? ""} className={input} />
          </div>
        </div>
      </Panel>

      <Panel title="Language" open={!!f.language}>
        <div>
          <label className={label} htmlFor="f-lang">Language</label>
          <select id="f-lang" name="lang" defaultValue={f.language} className={input}>
            <option value="">Any language</option>
            {LANGUAGES.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </Panel>

      <Panel title="Your BOOKLORE" open={signedIn && (f.list || f.unrated)}>
        {signedIn ? (
          <div className="space-y-3 text-[14px]">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="list" value="1" defaultChecked={f.list} className="h-4 w-4 accent-[var(--cobalt)]" />
              On my Reading List
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="unrated" value="1" defaultChecked={f.unrated} className="h-4 w-4 accent-[var(--cobalt)]" />
              Exclude books I&rsquo;ve rated
            </label>
          </div>
        ) : (
          <p className="text-[14px] text-muted">
            <a href="/signin?next=/search/advanced" className="font-semibold text-cobalt underline underline-offset-2">Sign in</a> to filter by your Reading List or your ratings.
          </p>
        )}
      </Panel>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="f-sort">Sort by</label>
          <select id="f-sort" name="sort" defaultValue={f.sort} className={input}>
            {ADV_SORTS.map((s) => (
              <option key={s} value={s}>{ADV_SORT_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="f-dir">Order</label>
          <select id="f-dir" name="dir" defaultValue={f.dir} className={input}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="mt-6 hidden gap-3 md:flex">
        <button type="submit" className="btn btn-primary flex-1">Search titles</button>
        <a href="/search/advanced" className="btn btn-ghost">Reset</a>
      </div>
    </form>
  );
}
