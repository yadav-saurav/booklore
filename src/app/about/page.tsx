import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/Section";

export const metadata: Metadata = { title: "About" };

const SOURCES = [
  { name: "Open Library", href: "https://openlibrary.org", role: "Primary catalogue", body: "Work and edition metadata, covers, authors and subject tags. Most titles in BOOKLORE start here." },
  { name: "Google Books", href: "https://books.google.com", role: "Secondary source", body: "Fills gaps in descriptions, page counts and ISBNs, and supplies covers when Open Library has none." },
];

export default function AboutPage() {
  return (
    <div className="page py-10 md:py-14">
      <SectionHeader as="h1" kanji="本について · About" title="About BOOKLORE" />

      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="prose-serif flex max-w-2xl flex-col gap-12 text-ink-2">
          <section aria-labelledby="what-h">
            <h2 id="what-h" className="sec-title mb-5 text-[20px] font-sans">What BOOKLORE is</h2>
            <p>
              BOOKLORE is a book archive modelled on the way film fans use an IMDb-style site: browse charts, open a title page,
              rate what you have read, write a review, keep a Reading List and publish lists for other readers.
            </p>
            <p className="mt-4">
              Everything is designed to answer two questions quickly: what is worth reading, and what do people who read
              like me think of it?
            </p>
          </section>

          <section aria-labelledby="sources-h">
            <h2 id="sources-h" className="sec-title mb-5 text-[20px] font-sans">Where the data comes from</h2>
            <ul className="not-prose grid gap-4 sm:grid-cols-2">
              {SOURCES.map((s) => (
                <li key={s.name} className="border border-hair bg-sheet p-5">
                  <p className="lbl text-cobalt">{s.role}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{s.name}</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{s.body}</p>
                  <a href={s.href} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[14px] font-semibold text-cobalt hover:underline">
                    Visit {s.name}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              Book data is cached locally, so a title you visit once loads from the archive afterwards. Cover images belong to
              their rights holders and are shown for identification only.
            </p>
          </section>

          <section aria-labelledby="ratings-h">
            <h2 id="ratings-h" className="sec-title mb-5 text-[20px] font-sans">How ratings and the Top 250 work</h2>
            <p>
              Every member rates a book from 1 to 10. A book&apos;s <strong className="text-ink">BOOKLORE rating</strong> is the
              plain average of those votes, shown to one decimal place next to the number of ratings.
            </p>
            <p className="mt-4">
              The <strong className="text-ink">Top 250</strong> does not use the plain average. It uses IMDb&apos;s published
              weighted formula, which pulls a title with few votes toward the catalogue mean:
            </p>
            <p className="mt-4 rounded-sm border border-hair bg-sheet px-5 py-4 font-sans text-[15px] text-ink">
              Weighted score = (v ÷ (v + m)) × R + (m ÷ (v + m)) × C
            </p>
            <p className="mt-4 text-[15px] text-muted">
              R is the book&apos;s average, v its number of votes, C the average across the catalogue, and m the minimum number
              of votes needed to be listed (25 here). Titles with fewer than m votes are still ranked, but they are held near C
              until more readers weigh in.
            </p>
            <p className="mt-4">
              <strong className="text-ink">BookMeter</strong> is separate. It ranks recent attention: page views, ratings,
              reviews and Reading List additions over the last seven days.
            </p>
          </section>

          <section aria-labelledby="sample-h" className="border-l-2 border-cobalt pl-5">
            <h2 id="sample-h" className="lbl mb-3 font-sans text-cobalt">A note on sample data</h2>
            <p className="text-[16px]">
              The member profiles, ratings, reviews, lists and follows you see across BOOKLORE are sample data, generated to
              show how the features work. They do not come from real readers. Book metadata comes from the sources above.
            </p>
          </section>
        </div>

        <aside className="h-fit border border-hair bg-sheet p-6">
          <p className="lbl text-cobalt">Get started</p>
          <nav className="mt-4 flex flex-col gap-1 text-[15px] font-semibold" aria-label="Start here">
            <Link href="/chart/top" className="py-1.5 hover:text-cobalt hover:underline">Top 250</Link>
            <Link href="/chart/bookmeter" className="py-1.5 hover:text-cobalt hover:underline">BookMeter</Link>
            <Link href="/genres" className="py-1.5 hover:text-cobalt hover:underline">Browse genres</Link>
            <Link href="/reviews" className="py-1.5 hover:text-cobalt hover:underline">Latest reviews</Link>
            <Link href="/community" className="py-1.5 hover:text-cobalt hover:underline">Community</Link>
            <Link href="/register" className="py-1.5 hover:text-cobalt hover:underline">Create an account</Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
