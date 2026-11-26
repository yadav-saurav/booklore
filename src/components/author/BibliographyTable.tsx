import Link from "next/link";
import type { BookCard, UserBookState } from "@/lib/queries/books";
import { BIB_SORTS, type BibSort } from "@/lib/queries/authors";
import { BookCover } from "@/components/book/BookCover";
import { StarIcon } from "@/components/book/Rating";
import { fmtRating } from "@/lib/util";
import { ChipRow } from "@/components/genre/ChipRow";
import { hrefWith, type Params } from "@/components/genre/href";

const COLUMNS: { key: BibSort; label: string; align?: "right"; className?: string }[] = [
  { key: "year", label: "Year" },
  { key: "title", label: "Title" },
  { key: "rating", label: "Rating", align: "right" },
  { key: "popularity", label: "Popularity", align: "right", className: "hidden md:table-cell" },
];

/** IMDb-style filmography table: year, cover, title, rating, your rating, genres. Sort and genre come from the URL. */
export function BibliographyTable({ path, current, sort, dir, genre, genres, books, states }: {
  path: string; current: Params; sort: BibSort; dir: "asc" | "desc"; genre?: string;
  genres: { slug: string; name: string }[]; books: BookCard[]; states: Record<string, UserBookState>;
}) {
  const sortHref = (key: BibSort) => {
    const nextDir = key === sort ? (dir === "asc" ? "desc" : "asc") : BIB_SORTS[key].defaultDir;
    return hrefWith(path, current, { sort: key, dir: nextDir });
  };
  const arrow = (key: BibSort) => (key === sort ? (dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div>
      <ChipRow label="Genre"
        items={[{ label: "All", href: hrefWith(path, current, { genre: null }), active: !genre },
          ...genres.map((g) => ({ label: g.name, href: hrefWith(path, current, { genre: g.slug }), active: genre === g.slug }))]} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[300px] border-collapse text-[14px]">
          <caption className="sr-only">Bibliography of works</caption>
          <thead>
            <tr className="border-b border-rule text-left text-[11px] uppercase tracking-[0.12em] text-muted">
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className={`py-2 font-semibold ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""} ${c.key === "year" ? "w-16" : ""}`}>
                  <Link href={sortHref(c.key)} aria-sort={c.key === sort ? (dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`hover:text-cobalt ${c.key === sort ? "text-ink" : ""}`}>
                    {c.label}{arrow(c.key)}
                  </Link>
                </th>
              ))}
              <th scope="col" className="w-16 py-2 text-right font-semibold">Yours</th>
              <th scope="col" className="hidden py-2 pl-4 font-semibold lg:table-cell">Genres</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => {
              const mine = states[b.id]?.rating ?? null;
              return (
                <tr key={b.id} className="border-b border-hair align-middle transition-colors hover:bg-cobalt-soft">
                  <td className="py-2.5 pr-3 tabular-nums text-muted">{b.year ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/book/${b.id}`} className="hidden w-9 shrink-0 sm:block" tabIndex={-1} aria-hidden>
                        <BookCover book={b} size="S" />
                      </Link>
                      <Link href={`/book/${b.id}`} className="font-semibold leading-snug hover:underline">{b.title}</Link>
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-1 tabular-nums">
                      <StarIcon className="h-3.5 w-3.5 text-star" />
                      <span className="font-semibold">{fmtRating(b.ratingAvg)}</span>
                    </span>
                  </td>
                  <td className="hidden py-2.5 text-right tabular-nums text-muted md:table-cell">{b.popularityRank ? `#${b.popularityRank}` : "—"}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {mine ? <span className="inline-flex items-center justify-end gap-1 font-semibold text-cobalt"><StarIcon className="h-3 w-3" />{mine}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td className="hidden py-2.5 pl-4 text-[13px] text-muted lg:table-cell">
                    {b.genres.length ? b.genres.slice(0, 3).join(" · ").replace(/-/g, " ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!books.length && (
          <div className="border border-dashed border-hair p-8 text-center text-muted">
            No titles{genre ? " in this genre" : ""} yet.{" "}
            {genre && <Link href={hrefWith(path, current, { genre: null })} className="font-semibold text-cobalt hover:underline">Clear the filter</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
