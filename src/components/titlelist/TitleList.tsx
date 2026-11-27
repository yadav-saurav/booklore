import Link from "next/link";
import type { TitleItem } from "@/lib/queries/users";
import { BookCard } from "@/components/book/BookCard";
import { BookCover } from "@/components/book/BookCover";
import { RateButton } from "@/components/book/RateButton";
import { StarIcon } from "@/components/book/Rating";
import { ShelfRibbon } from "@/components/book/ShelfRibbon";
import { ProgressForm } from "@/components/user/ProgressForm";
import { compact, fmtDate, fmtRating } from "@/lib/util";
import { InfoButton } from "./InfoButton";
import { StatusBadge, StatusControl } from "./StatusControl";
import type { TitleView } from "./params";

export type TitleMode = "shelf" | "ratings" | "list";
type Props = { items: TitleItem[]; view: TitleView; mode: TitleMode; genreNames: Record<string, string>; edit?: boolean; signedIn: boolean };

/** Detailed (IMDb default), Grid and Compact renderings of one list of titles. */
export function TitleList(p: Props) {
  if (p.view === "grid") return <Grid {...p} />;
  if (p.view === "compact") return <Compact {...p} />;
  return (
    <ol className="divide-y divide-hair">
      {p.items.map((b, i) => <DetailedRow key={b.id} b={b} n={i + 1} {...p} />)}
    </ol>
  );
}

function Gold({ b }: { b: TitleItem }) {
  return (
    <span className="inline-flex items-center gap-1 text-[14px]" aria-label={`BOOKLORE rating ${fmtRating(b.ratingAvg)} from ${b.ratingCount} ratings`}>
      <StarIcon className="h-4 w-4 text-star" />
      <span className="font-semibold text-ink">{fmtRating(b.ratingAvg)}</span>
      {b.ratingCount > 0 && <span className="text-muted">({compact(b.ratingCount)})</span>}
    </span>
  );
}

function DetailedRow({ b, n, mode, genreNames }: Props & { b: TitleItem; n: number }) {
  const meta = [b.year, b.pages && `${b.pages.toLocaleString("en-US")} pages`, b.genres.slice(0, 2).map((g) => genreNames[g] ?? g).join(", ")].filter(Boolean);
  return (
    <li className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-4 gap-y-3 py-5 sm:grid-cols-[70px_minmax(0,1fr)_auto] sm:gap-x-5">
      <div className="relative self-start [&>button]:!h-[33px] [&>button]:!w-[24px]">
        <Link href={`/book/${b.id}`} tabIndex={-1} aria-hidden className="block">
          <BookCover book={b} size="S" className="transition-[filter] hover:brightness-90" />
        </Link>
        <ShelfRibbon bookId={b.id} status={b.status} title={b.title} />
      </div>

      <div className="min-w-0">
        <h3 className="text-[16px] font-semibold leading-snug">
          <Link href={`/book/${b.id}`} className="hover:text-cobalt hover:underline">{n}. {b.title}</Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          {meta.map((m, i) => <span key={i} className="inline-flex items-center gap-2">{i > 0 && <span aria-hidden>·</span>}{m}</span>)}
          {mode === "shelf" && b.status && <span className="ml-1"><StatusBadge status={b.status} /></span>}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Gold b={b} />
          {mode === "ratings" ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-cobalt">
              <span className="font-semibold">Your rating</span>
              <RateButton bookId={b.id} title={b.title} current={b.yourRating} />
            </span>
          ) : (
            <RateButton bookId={b.id} title={b.title} current={b.yourRating} />
          )}
          {mode === "ratings" && b.ratedAt && <span className="text-[12.5px] text-muted">Rated {fmtDate(b.ratedAt)}</span>}
          {mode === "shelf" && b.addedAt && <span className="text-[12.5px] text-muted">Added {fmtDate(b.addedAt)}</span>}
        </div>
        {b.synopsis && <p className="mt-2 line-clamp-2 max-w-3xl text-[14px] leading-relaxed text-ink-2">{b.synopsis}</p>}
        {b.authorName && (
          <p className="mt-1.5 text-[13.5px]">
            <span className="font-semibold">Author</span>{" "}
            {b.authorId ? <Link href={`/author/${b.authorId}`} className="text-cobalt hover:underline">{b.authorName}</Link> : b.authorName}
          </p>
        )}
        {mode === "shelf" && b.status === "reading" && (
          <div className="mt-3"><ProgressForm bookId={b.id} progress={b.progress} pages={b.pages} /></div>
        )}
        {mode === "list" && b.note && (
          <blockquote className="prose-serif mt-3 max-w-3xl border-l-2 border-cobalt/40 pl-3 !text-[15px] italic text-ink-2">{b.note}</blockquote>
        )}
      </div>

      <div className="col-start-2 flex items-start gap-1 sm:col-start-3 sm:flex-col sm:items-end">
        <InfoButton book={b} />
        {mode === "shelf" && b.status && <StatusControl bookId={b.id} title={b.title} status={b.status} />}
      </div>
    </li>
  );
}

function Grid({ items, mode }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 pt-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 [&_article]:!w-full">
      {items.map((b) => (
        <li key={b.id} className="relative flex flex-col gap-2">
          <BookCard book={b} state={{ rating: b.yourRating, status: b.status }} showAction={false} />
          {mode === "shelf" && b.status && <div className="flex items-center justify-between"><StatusBadge status={b.status} /><StatusControl bookId={b.id} title={b.title} status={b.status} compact /></div>}
          {mode === "ratings" && b.ratedAt && <p className="text-[12px] text-muted">Rated {fmtDate(b.ratedAt)}</p>}
        </li>
      ))}
    </ul>
  );
}

function Compact({ items, mode, edit }: Props) {
  return (
    <div className="pt-2">
      <table className="w-full table-fixed border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-hair text-left">
            <th scope="col" className="lbl w-9 py-3 pr-2 text-right text-muted">#</th>
            <th scope="col" className="lbl py-3 pl-3 text-muted">Title</th>
            <th scope="col" className="lbl hidden w-16 py-3 text-muted sm:table-cell">Year</th>
            <th scope="col" className="lbl w-[72px] py-3 text-muted sm:w-24">Rating</th>
            <th scope="col" className="lbl w-[58px] py-3 text-muted sm:w-24"><span className="max-sm:sr-only">Yours</span><span className="sm:hidden" aria-hidden>You</span></th>
            <th scope="col" className={`lbl py-3 text-right text-muted ${mode === "shelf" ? (edit ? "w-[84px] sm:w-[150px]" : "w-[92px] sm:w-[130px]") : "w-12"}`}>
              <span className="sr-only sm:not-sr-only">{mode === "shelf" ? "Status" : "List"}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((b, i) => (
            <tr key={b.id} className="border-b border-hair transition-colors hover:bg-hair-2">
              <td className="py-2.5 pr-2 text-right tabular-nums text-muted">{i + 1}</td>
              <td className="truncate py-2.5 pl-3">
                <Link href={`/book/${b.id}`} className="font-semibold hover:text-cobalt hover:underline">{b.title}</Link>
                <span className="hidden text-muted md:inline">{b.authorName ? ` · ${b.authorName}` : ""}</span>
              </td>
              <td className="hidden py-2.5 tabular-nums text-ink-2 sm:table-cell">{b.year ?? "—"}</td>
              <td className="py-2.5"><span className="inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5 text-star" /><span className="font-semibold tabular-nums">{fmtRating(b.ratingAvg)}</span></span></td>
              <td className="py-1"><RateButton bookId={b.id} title={b.title} current={b.yourRating} /></td>
              <td className="py-1 text-right">
                {mode === "shelf" && b.status ? (
                  edit ? <div className="flex justify-end"><StatusControl bookId={b.id} title={b.title} status={b.status} compact /></div>
                    : <StatusBadge status={b.status} />
                ) : (
                  <div className="relative ml-auto h-[33px] w-[24px] [&>button]:!h-[33px] [&>button]:!w-[24px]"><ShelfRibbon bookId={b.id} status={b.status} title={b.title} /></div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
