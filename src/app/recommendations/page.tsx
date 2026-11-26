import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getRecommendationsForUser, getBecauseYouRated, type Recommendation } from "@/lib/recommend";
import { favouriteGenres, ratingCount, popularInGenreIds, onboardingIds } from "@/lib/recommend/engine";
import { getCardsByIds, getUserStates, getGenres, type BookCard as Card, type UserBookState } from "@/lib/queries/books";
import { BookCard } from "@/components/book/BookCard";
import { Rail } from "@/components/ui/Rail";
import { SectionHeader, Section } from "@/components/ui/Section";
import { OnboardingGrid } from "./OnboardingGrid";

export const metadata: Metadata = {
  title: "Picked for you",
  description: "Personalised book recommendations from your ratings and reading list.",
};

const ONBOARD_TARGET = 5;

export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const user = await getCurrentUser();
  const nRated = user ? await ratingCount(user.id) : 0;
  const showOnboarding = !!user && (welcome === "1" || nRated < ONBOARD_TARGET);

  const picks = await getRecommendationsForUser(user?.id ?? null, 24);
  const because = user ? await getBecauseYouRated(user.id, 3, 12) : [];
  const genres = await getGenres();
  const genreBySlug = new Map(genres.map((g) => [g.slug, g]));
  const favSlugs = user && nRated >= 3 ? await favouriteGenres(user.id, 3) : genres.slice().sort((a, b) => b.count - a.count).slice(0, 3).map((g) => g.slug);
  const genreRails = await Promise.all(favSlugs.map(async (slug) => ({ slug, books: await getCardsByIds((await popularInGenreIds(user?.id ?? null, slug, 12)).map((x) => x.id)) })));
  const onboarding = showOnboarding ? await getCardsByIds(await onboardingIds(user!.id, 24)) : [];

  const allIds = [...picks, ...because.flatMap((r) => [r.seed, ...r.books]), ...genreRails.flatMap((r) => r.books)].map((b) => b.id);
  const states = await getUserStates(user?.id, [...new Set(allIds)]);
  const personal = !!user && nRated >= 3;

  return (
    <div className="page pb-16">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-hair py-10 md:py-14">
        <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 select-none font-jp text-[160px] font-extrabold leading-none text-cobalt/[.07] md:text-[240px]">推薦</span>
        <p className="lbl font-jp text-cobalt">What to read · 推薦</p>
        <h1 className="mask mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
          <span className="rise inline-block">Picked for you</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">
          {personal
            ? <>Your picks come from the books you&apos;ve rated and shelved. We look for titles that readers with similar ratings loved, weigh how close they are in genre, subject and author, and then mix the list so no single shelf takes over.</>
            : <>Start with what the archive rates highest. Once you rate a few books, picks are matched to readers whose taste overlaps yours, then balanced by genre, subject and author.</>}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
          {user ? (
            <>
              <span className="box lbl text-ink-2">{nRated} rated</span>
              {!showOnboarding && <Link href="/recommendations?welcome=1" className="btn btn-outline btn-sm">Rate more books</Link>}
              <Link href="/you/ratings" className="btn btn-ghost btn-sm text-cobalt">Your ratings</Link>
            </>
          ) : (
            <>
              <Link href="/signin?next=%2Frecommendations%3Fwelcome%3D1" className="btn btn-primary btn-sm">Sign in for personal picks</Link>
              <Link href="/register" className="btn btn-outline btn-sm">Create an account</Link>
            </>
          )}
        </div>
      </header>

      {showOnboarding && (
        <Section className="border-b border-hair">
          <SectionHeader title="Rate books you've read to tune your picks" kanji="評価" subtitle="Popular titles from across the archive. Tap a star to rate, or skip the ones you haven't read." />
          <OnboardingGrid rated={nRated} target={ONBOARD_TARGET}
            books={onboarding.map(({ id, title, authorName, year, coverId, coverUrl }) => ({ id, title, authorName, year, coverId, coverUrl }))} />
        </Section>
      )}

      {/* Top picks */}
      <Section>
        <SectionHeader title={personal ? "Top picks" : "Top picks to start with"} kanji="選書" count={picks.length}
          subtitle={personal ? "Ranked for you, with the reason for each pick" : "Highly rated, widely read and spread across genres"} />
        {picks.length ? <PickGrid picks={picks} states={states} /> : <Empty>No picks yet. Rate a few books to get started.</Empty>}
        {!user && (
          <div className="mt-8 flex flex-col items-start gap-3 border border-hair bg-sheet p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Get picks that know your shelf</p>
              <p className="text-[14px] text-muted">Sign in and rate five books. Your list updates as you rate.</p>
            </div>
            <Link href="/signin?next=%2Frecommendations%3Fwelcome%3D1" className="btn btn-primary">Sign in</Link>
          </div>
        )}
      </Section>

      {/* Because you rated */}
      {because.map(({ seed, books }) => (
        <Section key={seed.id}>
          <SectionHeader title={`Because you rated ${seed.title}`} href={`/book/${seed.id}`}
            subtitle={`You gave it ${states[seed.id]?.rating ?? "–"}/10. More with a similar readership, subject and feel.`} />
          <Rail label={`Similar to ${seed.title}`}>
            {books.map((b) => <div role="listitem" key={b.id}><BookCard book={b} state={states[b.id]} /></div>)}
          </Rail>
        </Section>
      ))}

      {/* Popular in favourite genres */}
      {genreRails.filter((r) => r.books.length).map(({ slug, books }) => {
        const g = genreBySlug.get(slug);
        return (
          <Section key={slug}>
            <SectionHeader title={`Popular in ${g?.name ?? slug}`} href={`/genre/${slug}`} kanji={g?.kanji ?? undefined}
              subtitle={personal ? "One of your favourite genres" : "Widely read in the archive"} />
            <Rail label={`Popular in ${g?.name ?? slug}`}>
              {books.map((b) => <div role="listitem" key={b.id}><BookCard book={b} state={states[b.id]} /></div>)}
            </Rail>
          </Section>
        );
      })}
    </div>
  );
}

function PickGrid({ picks, states }: { picks: Recommendation[]; states: Record<string, UserBookState> }) {
  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {picks.map((b, i) => (
        <li key={b.id} className="flex min-w-0 flex-col gap-2 [&>article]:w-full! [&>article]:flex-1">
          {b.reason && <ReasonChip reason={b.reason} />}
          <BookCard book={b as Card} state={states[b.id]} rank={i + 1} />
        </li>
      ))}
    </ol>
  );
}

function ReasonChip({ reason }: { reason: string }) {
  return (
    <p title={reason} className="flex h-[42px] items-center gap-1.5 border-l-2 border-cobalt bg-cobalt-soft px-2 py-1 text-[11.5px] font-medium leading-snug text-cobalt">
      <span className="line-clamp-2">{reason}</span>
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-hair p-8 text-center text-muted">{children}</p>;
}
