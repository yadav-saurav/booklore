import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hydrateAuthor } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getUserStates } from "@/lib/queries/books";
import { getAuthor, getAuthorStats, getKnownFor, getBibliography, getAuthorGenres, getReadersAlsoLike, isBibSort, BIB_SORTS, type BibSort } from "@/lib/queries/authors";
import { getProvider } from "@/lib/providers/registry";
import { BookCard } from "@/components/book/BookCard";
import { Section, SectionHeader } from "@/components/ui/Section";
import { AuthorPhoto } from "@/components/author/AuthorPhoto";
import { BioClamp } from "@/components/author/BioClamp";
import { BibliographyTable } from "@/components/author/BibliographyTable";
import { OpenLibraryWorks } from "@/components/author/OpenLibraryWorks";
import { flatParams } from "@/components/genre/href";
import { fmtRating, compact, plural } from "@/lib/util";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = getAuthor(id);
  if (!a) return { title: "Author not found" };
  const desc = a.bio ? a.bio.slice(0, 155).trim() + "…" : `Books by ${a.name} on BOOKLORE: ratings, reviews and bibliography.`;
  return { title: a.name, description: desc, openGraph: { title: a.name, description: desc } };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = flatParams(await searchParams);

  await hydrateAuthor(id);
  const author = getAuthor(id);
  if (!author) notFound();

  const sort: BibSort = isBibSort(sp.sort) ? sp.sort : "year";
  const dir = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : BIB_SORTS[sort].defaultDir;
  const genre = sp.genre || undefined;
  const path = `/author/${author.id}`;

  const user = await getCurrentUser();
  const stats = getAuthorStats(id);
  const knownFor = getKnownFor(id, 4);
  const books = getBibliography(id, sort, dir, genre);
  const genres = getAuthorGenres(id);
  const readers = getReadersAlsoLike(id, 6);
  const states = getUserStates(user?.id, [...new Set([...knownFor, ...books].map((b) => b.id))]);

  const born = author.birthDate;
  const died = author.deathDate;
  const ol = getProvider("openlibrary");

  return (
    <div className="page pb-16 pt-8 md:pt-12">
      {/* Header: name in large type, photo, facts */}
      <header className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10 lg:grid-cols-[260px_1fr]">
        <div className="order-2 w-[52%] max-w-[200px] md:order-1 md:w-full md:max-w-none">
          <AuthorPhoto name={author.name} photoId={author.photoId} photoUrl={author.photoUrl} priority monogramSize={120} className="shadow-card" />
        </div>
        <div className="order-1 min-w-0 md:order-2">
          <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.02em]">{author.name}</h1>
          <p className="mt-3 text-[15px] text-muted">
            <span className="font-semibold text-ink-2">Author</span>
            {author.nationality ? <> · {author.nationality}</> : null}
          </p>

          <dl className="mt-6 grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-2">
            {born && (
              <div><dt className="lbl text-muted">Born</dt><dd className="mt-1">{born}</dd></div>
            )}
            {died && (
              <div><dt className="lbl text-muted">Died</dt><dd className="mt-1">{died}</dd></div>
            )}
            {!born && !died && <div className="sm:col-span-2"><dt className="sr-only">Life dates</dt><dd className="text-muted">Life dates not yet known.</dd></div>}
          </dl>

          {author.bio ? (
            <div className="mt-6"><BioClamp text={author.bio} /></div>
          ) : (
            <p className="mt-6 text-muted">No biography yet.</p>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-hair bg-hair sm:grid-cols-4">
            {[
              { k: "Books here", v: stats.books.toLocaleString("en-US") },
              { k: "Avg rating", v: fmtRating(stats.avgRating) },
              { k: "Ratings", v: compact(stats.totalRatings) },
              { k: "Popularity", v: stats.rank ? `#${stats.rank.toLocaleString("en-US")}` : "—" },
            ].map((s) => (
              <div key={s.k} className="bg-card p-4">
                <dt className="lbl text-muted">{s.k}</dt>
                <dd className="mt-1.5 text-2xl font-semibold tabular-nums">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* Known for */}
      {knownFor.length > 0 && (
        <Section className="!py-10">
          <SectionHeader title="Known for" />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 [&>li>article]:!w-full">
            {knownFor.map((b) => (
              <li key={b.id}><BookCard book={b} state={states[b.id]} /></li>
            ))}
          </ul>
        </Section>
      )}

      {/* Bibliography */}
      <Section className="!py-10">
        <SectionHeader title="Bibliography" count={books.length} subtitle="Every title in BOOKLORE by this author. Sort by any column, or filter by genre." />
        {books.length || genre ? (
          <BibliographyTable path={path} current={sp} sort={sort} dir={dir} genre={genre} genres={genres} books={books} states={states} />
        ) : (
          <div className="border border-dashed border-hair p-8 text-center text-muted">No titles in BOOKLORE for this author yet.</div>
        )}
      </Section>

      {/* Open Library */}
      {author.olKey && ol && (
        <Section className="!py-10">
          <SectionHeader title="More works on Open Library" subtitle="Titles that are not in BOOKLORE yet." />
          <Suspense fallback={<div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-5 w-full" />)}</div>}>
            <OpenLibraryWorks authorId={author.id} olKey={author.olKey} />
          </Suspense>
        </Section>
      )}

      {/* Readers also like */}
      {readers.length > 0 && (
        <Section className="!py-10">
          <SectionHeader title="Readers also like" subtitle="Authors that people who rate this writer 8 or higher tend to rate highly too." />
          <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {readers.map((r) => (
              <li key={r.id} className="min-w-0">
                <Link href={`/author/${r.id}`} className="group block">
                  <AuthorPhoto name={r.name} photoId={r.photoId} photoUrl={r.photoUrl} monogramSize={48} className="transition-[filter] group-hover:brightness-95" />
                  <p className="mt-2 truncate text-[14px] font-semibold group-hover:underline">{r.name}</p>
                  <p className="text-[12px] text-muted">{plural(r.fans, "fan")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-10 border-t border-hair pt-6 text-[13px] text-muted">
        <Link href="/authors" className="font-semibold text-cobalt hover:underline">← All popular authors</Link>
      </p>
    </div>
  );
}
