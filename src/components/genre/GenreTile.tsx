import Link from "next/link";
import { BookCover } from "@/components/book/BookCover";
import { plural } from "@/lib/util";
import type { GenreTile as Tile } from "@/lib/queries/genres";
import { HalftoneKanji } from "./HalftoneKanji";

/** Index tile for one genre: halftone kanji, name, book count and three covers. */
export function GenreTileCard({ g }: { g: Tile }) {
  return (
    <Link href={`/genre/${g.slug}`}
      className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden border border-hair bg-card p-5 transition-colors duration-300 hover:border-cobalt">
      {g.kanji && <HalftoneKanji kanji={g.kanji} size={120} className="absolute -right-3 -top-5 transition-transform duration-500 group-hover:-translate-y-1" />}
      <div className="relative">
        <h2 className="text-[22px] font-semibold leading-tight tracking-tight group-hover:text-cobalt">{g.name}</h2>
        <p className="mt-1 text-[13px] text-muted">{plural(g.count, "book")}</p>
      </div>
      <div className="relative mt-6 flex gap-2.5" aria-hidden>
        {g.covers.map((c) => (
          <div key={c.id} className="w-[58px] shrink-0 shadow-[0_1px_0_var(--hair)] transition-transform duration-300 group-hover:-translate-y-0.5 sm:w-[64px]">
            <BookCover book={{ id: c.id, title: c.title, coverId: c.coverId, coverUrl: c.coverUrl, authorName: c.authorName }} size="S" />
          </div>
        ))}
      </div>
    </Link>
  );
}
