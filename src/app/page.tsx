import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { maybeRefreshRankings } from "@/lib/aggregates";
import { getUserStates } from "@/lib/queries/books";
import { getRecommendationsForUser } from "@/lib/recommend";
import {
  getBornToday, getFanFavorites, getFeaturedLists, getGenreTiles, getLatestReviews, getNewAndNotable,
  getReadingList, getShelfBooks, getTopPreview, getTrending, getUserShelfStatus,
} from "@/lib/queries/home";
import { ShelfHero } from "@/components/home/ShelfHero";
import {
  AuthorRail, BookRail, GenreTiles, GroupHeading, HomeHeading, ListTiles, PromptCard, ReviewCards, TopTable, TrendingRail,
} from "@/components/home/HomeSections";

export const dynamic = "force-dynamic";

export default async function Home() {
  maybeRefreshRankings();
  const user = await getCurrentUser();

  let shelf = getShelfBooks(12);
  // TEMP-MOCK-START
  if (shelf.length < 3) shelf = [
    ["pride","Pride and Prejudice","Jane Austen",1813,"Classics","古典"],["frank","Frankenstein","Mary Shelley",1818,"Horror","恐怖"],
    ["moby","Moby-Dick","Herman Melville",1851,"Classics","古典"],["karen","Anna Karenina","Leo Tolstoy",1878,"Literary Fiction","文学"],
    ["gatsby","The Great Gatsby","F. Scott Fitzgerald",1925,"Classics","古典"],["hobbit","The Hobbit","J. R. R. Tolkien",1937,"Fantasy","幻想"],
    ["1984","Nineteen Eighty-Four","George Orwell",1949,"Science Fiction","空想科学"],["dune","Dune","Frank Herbert",1965,"Science Fiction","空想科学"],
    ["beloved","Beloved","Toni Morrison",1987,"Literary Fiction","文学"],["hp","Harry Potter and the Philosopher's Stone","J. K. Rowling",1997,"Fantasy","幻想"],
    ["road","The Road","Cormac McCarthy",2006,"Literary Fiction","文学"],["tomorrow","Tomorrow, and Tomorrow, and Tomorrow","Gabrielle Zevin",2022,"Literary Fiction","文学"],
  ].map(([id,title,a,y,g,k]) => ({ id: String(id), title: String(title), authorName: String(a), year: Number(y), genre: String(g), genreKanji: String(k),
    coverId: null, coverUrl: null, synopsis: "Sample synopsis placeholder used while the archive is being catalogued. Replace with seeded data.", pages: 320, ratingAvg: 8.4, ratingCount: 1200 }));
  // TEMP-MOCK-END
  const picks = await getRecommendationsForUser(user?.id ?? null, 18);
  const readingList = user ? getReadingList(user.id) : [];
  const favorites = getFanFavorites();
  const trending = getTrending(10);
  const fresh = getNewAndNotable();
  const genres = getGenreTiles().sort((a, b) => b.count - a.count).slice(0, 8);
  const born = getBornToday();
  const lists = getFeaturedLists(6);
  const reviews = getLatestReviews(3);
  const top = getTopPreview(10);

  const ids = [...new Set([...picks, ...readingList, ...favorites, ...trending, ...fresh, ...top].map((b) => b.id))];
  const states = getUserStates(user?.id, ids);
  const shelfStatus = getUserShelfStatus(user?.id, shelf.map((b) => b.id));

  return (
    <>
      {shelf.length >= 3 ? (
        <ShelfHero books={shelf} statuses={shelfStatus} />
      ) : (
        <section className="flex h-[60svh] items-center justify-center">
          <p className="lbl text-cobalt">The archive is being catalogued…</p>
        </section>
      )}

      <div id="home-content" className="page scroll-mt-4 pb-6 pt-14">
        <GroupHeading title="What to read" kanji="何を読む" />

        <section className="py-8" aria-labelledby="h-picks">
          <span id="h-picks" className="sr-only">Top picks for you</span>
          <HomeHeading title="Top picks for you" href="/recommendations" subtitle={user ? "Books picked from your ratings and reading list" : "Popular, highly rated books to start with"} />
          {user ? (
            <BookRail label="Top picks for you" books={picks} states={states} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <BookRail label="Popular picks" books={picks.slice(0, 12)} states={states} />
              <PromptCard title="Sign in to get personalised picks" body="Rate a few books you've read and BOOKLORE will learn what you like." href="/signin?next=/recommendations" cta="Sign in" />
            </div>
          )}
        </section>

        <section className="py-8">
          <HomeHeading title="From your Reading List" href="/readinglist" subtitle={user ? "Books you want to read next" : undefined} />
          {user && readingList.length > 0 ? (
            <BookRail label="From your Reading List" books={readingList} states={states} />
          ) : user ? (
            <PromptCard title="Your Reading List is empty" body="Tap the bookmark ribbon on any cover to save it for later." href="/chart/bookmeter" cta="Browse popular books" />
          ) : (
            <PromptCard title="Sign in to access your Reading List" body="Save books to a list so you never lose track of what to read next." href="/signin" cta="Sign in to BOOKLORE" />
          )}
        </section>

        <section className="py-8">
          <HomeHeading title="Fan favorites" href="/chart/top" subtitle="This week's top books, by weighted reader rating" />
          <BookRail label="Fan favorites" books={favorites} states={states} />
        </section>

        <section className="py-8">
          <HomeHeading title="Top 10 on BOOKLORE this week" href="/chart/bookmeter" kanji="人気" subtitle="Trending by views, ratings, reviews and shelf adds" />
          <TrendingRail books={trending} states={states} />
        </section>

        <section className="py-8">
          <HomeHeading title="New & notable" href="/chart/new" subtitle="Recent books readers are picking up" />
          {fresh.length ? <BookRail label="New & notable" books={fresh} states={states} /> : <p className="text-muted">No recent books yet.</p>}
        </section>

        <div className="pt-10"><GroupHeading title="Explore" kanji="探す" /></div>

        <section className="py-8">
          <HomeHeading title="Browse by genre" href="/genres" />
          <GenreTiles genres={genres} />
        </section>

        <section className="py-8">
          <HomeHeading
            title={born.bornToday ? "Born today" : "Popular authors"}
            href={born.bornToday ? "/authors?born=today" : "/authors"}
            kanji="作家"
            subtitle={born.bornToday ? `Authors born on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : "Most-read authors on BOOKLORE"}
          />
          <AuthorRail authors={born.authors} />
        </section>

        <section className="py-8">
          <HomeHeading title="Featured lists" href="/lists" subtitle="Curated by editors and readers" />
          <ListTiles lists={lists} />
        </section>

        <section className="py-8">
          <HomeHeading title="Latest reviews" href="/reviews" kanji="評" />
          <ReviewCards reviews={reviews} />
        </section>

        <section className="py-8">
          <HomeHeading title="Top 250 Books" href="/chart/top" subtitle="As rated by regular BOOKLORE readers" />
          <TopTable books={top} states={states} />
          <div className="mt-6 text-center">
            <Link href="/chart/top" className="btn btn-outline">See the full Top 250</Link>
          </div>
        </section>
      </div>
    </>
  );
}
