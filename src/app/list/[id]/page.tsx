import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getGenres } from "@/lib/queries/books";
import { getListDetail, getListLikeState } from "@/lib/queries/lists";
import { getTitleItems } from "@/lib/queries/users";
import { LikeButton } from "@/components/lists/LikeButton";
import { ListHeader } from "@/components/titlelist/ListHeader";
import { ListToolbar } from "@/components/titlelist/ListToolbar";
import { TitleList } from "@/components/titlelist/TitleList";
import { EmptyList } from "@/components/titlelist/EmptyList";
import { listHref, parseListState, refineCount, TITLE_SORT_DIR_ORDER, type SortKey, type SP } from "@/components/titlelist/params";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SP> };
const SORTS: SortKey[] = ["order", "title", "rating", "votes", "popularity", "year", "pages", "yours"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lid = Number((await params).id);
  const list = Number.isInteger(lid) && lid > 0 ? await getListDetail(lid) : null;
  return { title: list ? list.title : "List", description: list?.description || undefined };
}

export default async function ListPage({ params, searchParams }: Props) {
  const lid = Number((await params).id);
  if (!Number.isInteger(lid) || lid < 1) notFound();
  const [me, list] = await Promise.all([getCurrentUser(), getListDetail(lid)]);
  if (!list) notFound();
  const isOwner = me?.id === list.ownerId;
  if (!list.isPublic && !isOwner) notFound();

  const state = parseListState(await searchParams, SORTS);
  const path = `/list/${lid}`;
  const [{ items, total, genres }, like, allGenres] = await Promise.all([
    getTitleItems({ kind: "list", listId: lid }, me?.id ?? null, {
      sort: state.sort, dir: state.dir ?? undefined,
      filters: { genres: state.genres, minRating: state.minRating, yearFrom: state.yearFrom, yearTo: state.yearTo },
    }),
    getListLikeState(lid, me?.id ?? null),
    getGenres(),
  ]);
  const genreNames = Object.fromEntries(allGenres.map((g) => [g.slug, g.name]));

  return (
    <>
      <ListHeader kicker={`${list.isFeatured ? "Featured list" : "User list"} · リスト`} title={list.title} isPublic={list.isPublic}
        owner={{ name: list.ownerName, username: list.ownerUsername, hue: list.ownerHue }} editedAt={list.updatedAt}
        description={list.description} editHref={isOwner ? `/list/${lid}/edit` : null} sharePath={path}
        stats={<span className="text-muted">{total.toLocaleString("en-US")} {total === 1 ? "title" : "titles"}</span>}
        extra={<LikeButton listId={lid} initialLiked={like.liked} initialCount={like.likeCount} />} />
      <div className="page pb-16">
        <ListToolbar state={state} sorts={SORTS} defaultSort="order" count={items.length} total={total} genres={genres}
          naturalDir={TITLE_SORT_DIR_ORDER(state.sort, true)} />
        {items.length ? (
          <TitleList items={items} view={state.view} mode="list" genreNames={genreNames} signedIn={!!me} />
        ) : (
          <EmptyList title="This list has no titles yet" actions={false} filtered={total > 0 && refineCount(state) > 0}
            clearHref={listHref(path, { ...state, genres: [], minRating: null, yearFrom: null, yearTo: null })}
            body={isOwner ? "Use Edit to add books and notes." : "Check back later; the owner hasn't added any books."} />
        )}
      </div>
    </>
  );
}
