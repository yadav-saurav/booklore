import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getGenres } from "@/lib/queries/books";
import { getLastEdited, getShelfCounts, getTitleItems } from "@/lib/queries/users";
import { ListHeader } from "@/components/titlelist/ListHeader";
import { ListToolbar } from "@/components/titlelist/ListToolbar";
import { TitleList } from "@/components/titlelist/TitleList";
import { EmptyList } from "@/components/titlelist/EmptyList";
import { SignedOutCard } from "@/components/titlelist/SignedOutCard";
import { listHref, parseListState, refineCount, TITLE_SORT_DIR_ORDER, type SortKey, type SP } from "@/components/titlelist/params";

export const metadata: Metadata = { title: "Your Reading List" };

const SORTS: SortKey[] = ["order", "title", "rating", "votes", "popularity", "year", "pages", "yours", "rated"];

export default async function ReadingListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await getCurrentUser();
  if (!me) {
    return <SignedOutCard next="/readinglist" kicker="Your Reading List · 読みたい本" title="Sign in to access your Reading List"
      body="Save books you want to read, track what you're reading now, and keep a record of what you've finished. It follows you on every device." />;
  }
  const state = parseListState(await searchParams, SORTS);
  const [{ items, total, genres }, counts, edited, allGenres] = await Promise.all([
    getTitleItems({ kind: "shelf", userId: me.id }, me.id, {
      sort: state.sort, dir: state.dir ?? undefined,
      filters: { genres: state.genres, statuses: state.statuses, minRating: state.minRating, yearFrom: state.yearFrom, yearTo: state.yearTo },
    }),
    getShelfCounts(me.id),
    getLastEdited("shelf", me.id),
    getGenres(),
  ]);
  const genreNames = Object.fromEntries(allGenres.map((g) => [g.slug, g.name]));
  const editing = state.edit;

  return (
    <>
      <ListHeader kicker="Your Reading List · 読みたい本" title="Your Reading List" isPublic={false} editedAt={edited}
        owner={{ name: me.displayName, username: me.username, hue: me.avatarHue }}
        description="Books you want to read, are reading now, or have finished. Only you can see this list."
        editHref={editing ? listHref("/readinglist", state, { edit: false }) : listHref("/readinglist", state, { edit: true, view: "compact" })}
        editLabel={editing ? "Done" : "Edit"} />
      <div className="page pb-16">
        <ListToolbar state={state} sorts={SORTS} defaultSort="order" count={items.length} total={total} genres={genres}
          statusChips={{ counts }} naturalDir={TITLE_SORT_DIR_ORDER(state.sort, false)} />
        {items.length ? (
          <TitleList items={items} view={state.view} mode="shelf" genreNames={genreNames} edit={editing} signedIn />
        ) : (
          <EmptyList title="Your Reading List is empty" filtered={total > 0 && refineCount(state) > 0}
            clearHref={listHref("/readinglist", { ...state, genres: [], statuses: [], minRating: null, yearFrom: null, yearTo: null })}
            body="Tap the bookmark ribbon on any cover, or “Add to Reading List” on a title page, to save books for later." />
        )}
      </div>
    </>
  );
}
