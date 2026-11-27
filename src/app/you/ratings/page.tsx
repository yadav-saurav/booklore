import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getGenres } from "@/lib/queries/books";
import { getLastEdited, getTitleItems, ratingHistogram } from "@/lib/queries/users";
import { ListHeader } from "@/components/titlelist/ListHeader";
import { ListToolbar } from "@/components/titlelist/ListToolbar";
import { TitleList } from "@/components/titlelist/TitleList";
import { EmptyList } from "@/components/titlelist/EmptyList";
import { RatingsPanel } from "@/components/titlelist/RatingsPanel";
import { SignedOutCard } from "@/components/titlelist/SignedOutCard";
import { listHref, parseListState, refineCount, TITLE_SORT_DIR_ORDER, type SortKey, type SP } from "@/components/titlelist/params";

export const metadata: Metadata = { title: "Your Ratings" };

const SORTS: SortKey[] = ["order", "yours", "title", "rating", "votes", "popularity", "year", "pages"];
const PATH = "/you/ratings";

export default async function YourRatingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await getCurrentUser();
  if (!me) {
    return <SignedOutCard next={PATH} kicker="Your Ratings · あなたの評価" title="Sign in to see your ratings"
      body="Every book you rate is saved here with your score, the date, and a breakdown of how you rate." />;
  }
  const state = parseListState(await searchParams, SORTS);
  const [{ items, total, genres }, hist, edited, allGenres] = await Promise.all([
    getTitleItems({ kind: "ratings", userId: me.id }, me.id, {
      sort: state.sort, dir: state.dir ?? undefined,
      filters: { genres: state.genres, minRating: state.minRating, yearFrom: state.yearFrom, yearTo: state.yearTo, score: state.score },
    }),
    ratingHistogram(me.id),
    getLastEdited("ratings", me.id),
    getGenres(),
  ]);
  const n = hist.reduce((s, h) => s + h.count, 0);
  const mean = n ? hist.reduce((s, h) => s + h.score * h.count, 0) / n : null;
  const genreNames = Object.fromEntries(allGenres.map((g) => [g.slug, g.name]));

  return (
    <>
      <ListHeader kicker="Your Ratings · あなたの評価" title="Your Ratings" isPublic editedAt={edited}
        owner={{ name: me.displayName, username: me.username, hue: me.avatarHue }} sharePath={`/user/${me.username}`}
        stats={<span className="font-semibold text-ink">{n.toLocaleString("en-US")} ratings{mean ? <span className="font-normal text-muted"> · average {mean.toFixed(1)}</span> : null}</span>}
        description="Every book you've rated. Click a star to change a rating, or a bar in the breakdown to see one score." />
      <div className="page grid gap-x-10 pb-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <ListToolbar state={state} sorts={SORTS} defaultSort="order" count={items.length} total={total} genres={genres}
            naturalDir={TITLE_SORT_DIR_ORDER(state.sort, false)} />
          <div className="py-5 lg:hidden"><RatingsPanel hist={hist} state={state} path={PATH} defaultSort="order" /></div>
          {items.length ? (
            <TitleList items={items} view={state.view} mode="ratings" genreNames={genreNames} signedIn />
          ) : (
            <EmptyList title="You haven't rated anything yet" filtered={total > 0 && refineCount(state) > 0}
              clearHref={listHref(PATH, { ...state, genres: [], minRating: null, yearFrom: null, yearTo: null, score: null })}
              body="Rate books from any cover or title page and they'll be collected here." />
          )}
        </div>
        <aside className="hidden pt-6 lg:block" aria-label="Ratings breakdown">
          <div className="sticky top-[84px]"><RatingsPanel hist={hist} state={state} path={PATH} defaultSort="order" /></div>
        </aside>
      </div>
    </>
  );
}
