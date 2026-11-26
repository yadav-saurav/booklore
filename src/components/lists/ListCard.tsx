import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import { Avatar } from "@/components/ui/Avatar";
import type { ListSummary } from "@/lib/queries/lists";
import { plural, compact } from "@/lib/util";

/** Four-cover mosaic: the first four titles in the list, with empty cells when there are fewer. */
export function CoverMosaic({ covers }: { covers: ListSummary["covers"] }) {
  return (
    <div className="grid aspect-square grid-cols-2 gap-px overflow-hidden border border-hair bg-hair">
      {[0, 1, 2, 3].map((i) => {
        const c = covers[i];
        return c ? (
          <div key={i} className="relative h-full w-full overflow-hidden">
            <BookCover book={{ id: c.id, title: c.title, coverId: c.coverId, coverUrl: c.coverUrl }} size="S" className="h-full w-full !aspect-auto" />
          </div>
        ) : (
          <div key={i} className="flex h-full w-full items-center justify-center bg-hair-2 font-jp text-[11px] text-muted" aria-hidden>
            本
          </div>
        );
      })}
    </div>
  );
}

/** List card for index pages: mosaic, title, owner, count and likes. */
export function ListCard({ list }: { list: ListSummary }) {
  return (
    <article className="group flex min-w-0 flex-col gap-3">
      <Link href={`/list/${list.id}`} className="block" tabIndex={-1} aria-hidden>
        <CoverMosaic covers={list.covers} />
      </Link>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <Link href={`/list/${list.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-cobalt hover:underline">{list.title}</Link>
          {!list.isPublic && <span className="box lbl mt-0.5 shrink-0 text-muted">Private</span>}
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
          <Avatar name={list.ownerName} hue={list.ownerHue} size={16} className="!text-[7px]" />
          <Link href={`/user/${list.ownerUsername}`} className="truncate font-semibold text-ink-2 hover:text-cobalt hover:underline">{list.ownerName}</Link>
        </p>
        <p className="mt-1 text-[13px] text-muted">
          {plural(list.itemCount, "title")} · <span className="tabular-nums">{compact(list.likeCount)}</span> {list.likeCount === 1 ? "like" : "likes"}
        </p>
      </div>
    </article>
  );
}
