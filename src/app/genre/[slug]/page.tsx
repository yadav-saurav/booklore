import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserStates } from "@/lib/queries/books";
import {
  getGenre, getTopRatedInGenre, getGenreBooks, getGenreDecades, getRelatedGenres, isGenreSort, type GenreFilters,
} from "@/lib/queries/genres";
import { BookCard } from "@/components/book/BookCard";
import { Rail } from "@/components/ui/Rail";
import { Section, SectionHeader } from "@/components/ui/Section";
import { HalftoneKanji } from "@/components/genre/HalftoneKanji";
import { GenreBrowse } from "@/components/genre/GenreBrowse";
import { flatParams } from "@/components/genre/href";
import { plural } from "@/lib/util";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const PAGE_SIZE = 24;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = getGenre(slug);
  if (!g) return { title: "Genre not found" };
  return { title: g.name, description: g.description || `Browse ${g.name} books on BOOKLORE.` };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = flatParams(await searchParams);
  const genre = getGenre(slug);
  if (!genre) notFound();

  const sort = isGenreSort(sp.sort) ? sp.sort : "popularity";
  const decadeNum = parseInt(sp.decade ?? "", 10);
  const minNum = parseInt(sp.min ?? "", 10);
  const filters: GenreFilters = {
    sort,
    decade: Number.isFinite(decadeNum) && decadeNum % 10 === 0 && decadeNum >= 1000 ? decadeNum : undefined,
    minRating: [6, 7, 8, 9].includes(minNum) ? minNum : undefined,
    page: Math.max(1, parseInt(sp.page ?? "1", 10) || 1),
    pageSize: PAGE_SIZE,
  };
  const view = sp.view === "list" ? "list" : "grid";
  const path = `/genre/${genre.slug}`;

  const user = await getCurrentUser();
  const top = getTopRatedInGenre(slug, 12);
  const decades = getGenreDecades(slug);
  const { rows, total } = getGenreBooks(slug, filters);
  const related = getRelatedGenres(slug, 8);
  const states = getUserStates(user?.id, [...new Set([...top, ...rows].map((b) => b.id))]);

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-hair">
        <div className="page grid items-end gap-6 pb-10 pt-10 md:grid-cols-[1fr_auto] md:pb-12 md:pt-14">
          <div className="min-w-0">
            <p className="lbl text-muted"><Link href="/genres" className="hover:text-cobalt">Genres</Link> / {genre.name}</p>
            <h1 className="mt-3 text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1] tracking-[-0.025em]">{genre.name}</h1>
            {genre.description && <p className="prose-serif mt-4 max-w-[60ch] text-ink-2">{genre.description}</p>}
            <p className="mt-4 text-[14px] text-muted">{plural(genre.count, "book")} on the shelf</p>
          </div>
          {genre.kanji && (
            <HalftoneKanji kanji={genre.kanji} size={160} className="self-start md:self-end md:pr-4 max-md:absolute max-md:-right-4 max-md:top-2 max-md:opacity-60" />
          )}
        </div>
      </header>

      {top.length > 0 && (
        <Section className="!py-10">
          <div className="page">
            <SectionHeader title={`Top rated in ${genre.name}`} subtitle="Weighted so a few hundred ratings count for more than a handful." />
          </div>
          <div className="page">
            <Rail label={`Top rated in ${genre.name}`}>
              {top.map((b) => (
                <div key={b.id} role="listitem"><BookCard book={b} state={states[b.id]} /></div>
              ))}
            </Rail>
          </div>
        </Section>
      )}

      <Section className="!pt-4">
        <div className="page">
          <SectionHeader title="Browse" count={total} />
          <GenreBrowse path={path} current={sp} sort={filters.sort} decade={filters.decade} minRating={filters.minRating} view={view}
            decades={decades} rows={rows} total={total} page={filters.page} pageSize={PAGE_SIZE} states={states} />
        </div>
      </Section>

      {related.length > 0 && (
        <Section className="!py-10">
          <div className="page">
            <SectionHeader title="Related genres" subtitle="Genres that most often share a book with this one." />
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link href={`/genre/${g.slug}`} className="group relative flex items-center justify-between overflow-hidden border border-hair bg-card px-5 py-4 transition-colors hover:border-cobalt">
                    <span className="font-semibold group-hover:text-cobalt">{g.name}</span>
                    <span className="text-[13px] tabular-nums text-muted">{g.shared.toLocaleString("en-US")} shared</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
}
