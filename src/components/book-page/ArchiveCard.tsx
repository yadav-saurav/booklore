import Link from "next/link";
import { hash01 } from "@/lib/util";
import type { BookDetail } from "@/lib/queries/book-page";
import { olWorkUrl } from "./format";

const SPINES = [
  { bg: "bg-cobalt", fg: "text-cobalt-ink", band: "bg-cobalt-ink/30" },
  { bg: "bg-ink", fg: "text-paper", band: "bg-vermilion" },
  { bg: "bg-vermilion", fg: "text-paper", band: "bg-ink/40" },
];

/**
 * Centre "media" panel of the hero: an archive catalogue card with a large generated spine,
 * in place of IMDb's trailer player. Links out to Open Library's "look inside" when we know the work.
 */
export function ArchiveCard({ book, className = "" }: { book: BookDetail; className?: string }) {
  const h = hash01(book.id);
  const s = SPINES[Math.floor(h * SPINES.length)];
  const catNo = `BL-${String(Math.floor(h * 9000) + 1000)}-${book.title.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "XX"}`;
  const shelfMark = `${(book.genres[0]?.slug ?? "gen").slice(0, 3).toUpperCase()} ${String(Math.floor(hash01(book.id + "s") * 900) + 100)}.${Math.floor(hash01(book.id + "t") * 90) + 10}`;
  const kanji = book.genres[0]?.kanji ?? "書";
  const rows: [string, React.ReactNode][] = [
    ["Author", book.authorName ?? "Unknown"],
    ["First published", book.year ?? "—"],
    ["Extent", book.pages ? `${book.pages} pp.` : "—"],
    ["Class", book.genres.map((g) => g.name).join(" / ") || "Unclassified"],
  ];
  return (
    <div className={`relative flex overflow-hidden border border-hair bg-card shadow-card ${className}`}>
      {/* Spine */}
      <div className={`relative flex w-[92px] shrink-0 flex-col items-center justify-between py-5 ${s.bg} ${s.fg}`} aria-hidden>
        <span className="font-jp text-[22px] font-extrabold leading-[1.05] [writing-mode:vertical-rl]">{kanji}</span>
        <span className="flex flex-1 items-center overflow-hidden py-4">
          <span className="line-clamp-1 max-h-full font-serif text-[22px] font-bold leading-none tracking-tight [writing-mode:vertical-rl]">{book.title}</span>
        </span>
        <span className="flex w-full flex-col items-center gap-2">
          <span className={`h-[3px] w-full ${s.band}`} />
          <span className="lbl text-[8.5px] [writing-mode:vertical-rl]">{book.authors[0]?.name.split(" ").slice(-1)[0] ?? "Anon"}</span>
          <span className={`h-[3px] w-full ${s.band}`} />
        </span>
      </div>

      {/* Catalogue card */}
      <div className="relative flex min-w-0 flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="lbl text-cobalt">Booklore archive · Catalogue card</p>
          <p className="lbl shrink-0 tabular-nums text-muted">No. {catNo}</p>
        </div>
        <p className="mt-4 line-clamp-2 font-serif text-[28px] font-semibold leading-[1.1] tracking-tight md:text-[32px]">{book.title}</p>
        {book.subtitle && <p className="mt-1 line-clamp-1 font-serif text-[16px] italic text-ink-2">{book.subtitle}</p>}
        <dl className="mt-4 flex-1 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-3 border-b border-dashed border-hair py-[7px]">
              <dt className="lbl self-center text-muted">{k}</dt>
              <dd className="truncate text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="lbl box tabular-nums text-ink-2">Shelf {shelfMark}</span>
          {book.olWorkKey ? (
            <a href={olWorkUrl(book.olWorkKey)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
              Look inside
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            </a>
          ) : (
            <Link href={`/book/${book.id}/reviews`} className="btn btn-sm btn-outline">Read reviews</Link>
          )}
        </div>
        {/* Archive stamp */}
        <div className="pointer-events-none absolute bottom-16 right-6 hidden h-[86px] w-[86px] rotate-[-14deg] items-center justify-center rounded-full border-2 border-vermilion/55 text-center text-vermilion/70 lg:flex" aria-hidden>
          <span className="lbl leading-[1.35] text-[9px]">Archived<br /><span className="text-[15px] tracking-[0.08em]">{book.year ?? "n.d."}</span><br />Booklore</span>
        </div>
      </div>
    </div>
  );
}
