import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getListDetail, getListItems, getListLikeState } from "@/lib/queries/lists";
import { BookCover } from "@/components/book/BookCover";
import { RatingInline } from "@/components/book/Rating";
import { RateButton } from "@/components/book/RateButton";
import { Avatar } from "@/components/ui/Avatar";
import { LikeButton } from "@/components/lists/LikeButton";
import { CoverMosaic } from "@/components/lists/ListCard";
import { plural } from "@/lib/util";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lid = Number((await params).id);
  const list = Number.isInteger(lid) ? await getListDetail(lid) : null;
  return { title: list ? list.title : "List" };
}

export default async function ListPage({ params }: Params) {
  const lid = Number((await params).id);
  if (!Number.isInteger(lid) || lid < 1) notFound();
  const me = await getCurrentUser();
  const list = await getListDetail(lid);
  if (!list) notFound();
  const isOwner = me?.id === list.ownerId;
  if (!list.isPublic && !isOwner) notFound();

  const items = await getListItems(lid, me?.id ?? null);
  const like = await getListLikeState(lid, me?.id ?? null);

  return (
    <div className="page py-10 md:py-14">
      <header className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <div className="max-w-[260px] md:max-w-none">
          <CoverMosaic covers={list.covers} />
        </div>
        <div className="flex flex-col justify-end">
          <p className="lbl flex items-center gap-2 text-cobalt font-jp">
            リスト{!list.isPublic && <span className="box text-muted">Private</span>}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{list.title}</h1>
          {list.description && <p className="prose-serif mt-4 max-w-2xl text-ink-2">{list.description}</p>}
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-muted">
            <Link href={`/user/${list.ownerUsername}`} className="inline-flex items-center gap-2 font-semibold text-ink hover:text-cobalt">
              <Avatar name={list.ownerName} hue={list.ownerHue} size={24} />
              {list.ownerName}
            </Link>
            <span aria-hidden>·</span>
            <span>{plural(list.itemCount, "title")}</span>
            <span aria-hidden>·</span>
            <span>{like.likeCount.toLocaleString("en-US")} {like.likeCount === 1 ? "like" : "likes"}</span>
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <LikeButton listId={lid} initialLiked={like.liked} initialCount={like.likeCount} />
            {isOwner && <Link href={`/list/${lid}/edit`} className="btn btn-outline btn-sm">Edit list</Link>}
          </div>
        </div>
      </header>

      <section aria-labelledby="items-h" className="mt-12">
        <h2 id="items-h" className="sec-title mb-6 text-[20px]">Titles <span className="text-base font-medium text-muted">{list.itemCount}</span></h2>
        {items.length === 0 ? (
          <div className="border border-dashed border-hair py-14 text-center">
            <p className="text-[15px] text-muted">This list has no titles yet.</p>
            {isOwner && <Link href={`/list/${lid}/edit`} className="btn btn-outline btn-sm mt-4">Add some</Link>}
          </div>
        ) : (
          <ol className="border-t border-hair">
            {items.map((it) => (
              <li key={it.id} className="grid grid-cols-[2.25rem_64px_minmax(0,1fr)] gap-x-4 border-b border-hair py-5 sm:grid-cols-[3rem_80px_minmax(0,1fr)_auto] sm:gap-x-6">
                <span className="pt-1 text-right text-2xl font-light tabular-nums text-muted" aria-hidden>{it.position + 1}</span>
                <Link href={`/book/${it.id}`} className="block" tabIndex={-1} aria-hidden>
                  <BookCover book={it} size="S" />
                </Link>
                <div className="min-w-0">
                  <Link href={`/book/${it.id}`} className="font-semibold leading-snug hover:text-cobalt hover:underline">{it.title}</Link>
                  <p className="text-[13px] text-muted">{it.authorName ?? "Unknown author"}{it.year ? ` · ${it.year}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <RatingInline avg={it.ratingAvg} count={it.ratingCount} />
                    {me && (
                      <span className="flex items-center gap-1">
                        <span className="text-muted">Yours</span>
                        <RateButton bookId={it.id} title={it.title} current={it.yourRating} />
                      </span>
                    )}
                  </div>
                  {it.note && <p className="prose-serif mt-2 text-[15px] italic text-ink-2">“{it.note}”</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
