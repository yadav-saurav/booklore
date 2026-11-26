import Link from "next/link";
import { AuthorPhoto } from "./AuthorPhoto";
import type { AuthorListItem } from "@/lib/queries/authors";
import { plural } from "@/lib/util";

/** One ranked row of the popular-authors list (IMDb "Most popular celebrities" style). */
export function AuthorListRow({ rank, a }: { rank: number; a: AuthorListItem }) {
  return (
    <li className="flex items-center gap-4 py-3.5">
      <span className="w-9 shrink-0 text-right text-[15px] font-semibold tabular-nums text-muted md:w-12">{rank}</span>
      <Link href={`/author/${a.id}`} tabIndex={-1} aria-hidden className="w-14 shrink-0 md:w-16">
        <AuthorPhoto name={a.name} photoId={a.photoId} photoUrl={a.photoUrl} monogramSize={32} className="w-full" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/author/${a.id}`} className="block truncate text-[16px] font-semibold leading-tight hover:underline">{a.name}</Link>
        <p className="mt-0.5 truncate text-[13px] text-muted">
          {a.nationality ? `${a.nationality} · ` : ""}
          {a.knownFor ? <>Known for <span className="text-ink-2">{a.knownFor}</span></> : "No titles yet"}
        </p>
      </div>
      <p className="shrink-0 text-right text-[13px] tabular-nums text-muted">{plural(a.bookCount, "book")}</p>
    </li>
  );
}
