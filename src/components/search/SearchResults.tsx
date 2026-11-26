import Link from "next/link";
import { BookRow } from "@/components/book/BookCard";
import { RateButton } from "@/components/book/RateButton";
import { Avatar } from "@/components/ui/Avatar";
import type { BookCard, UserBookState } from "@/lib/queries/books";
import type { AuthorHit } from "@/lib/search";
import type { ListHit } from "@/app/search/data";
import { hash01, plural } from "@/lib/util";

/** A title hit: IMDb's find-page row with cover, year and author, plus the Rate star. */
export function TitleResult({ book, state }: { book: BookCard; state?: UserBookState }) {
  return (
    <li className="border-b border-hair py-4 last:border-b-0">
      <BookRow book={book} meta={<RateButton bookId={book.id} title={book.title} current={state?.rating ?? null} />} />
    </li>
  );
}

export function AuthorResult({ author }: { author: AuthorHit }) {
  const years = [author.birthDate?.slice(0, 4), author.deathDate?.slice(0, 4)].filter(Boolean).join("–");
  return (
    <li className="flex items-center gap-4 border-b border-hair py-3.5 last:border-b-0">
      <Avatar name={author.name} hue={Math.round(hash01(author.id) * 360)} size={52} />
      <div className="min-w-0 flex-1">
        <Link href={`/author/${author.id}`} className="font-semibold hover:underline">{author.name}</Link>
        <p className="truncate text-[13px] text-muted">
          {[years || null, author.knownFor ? `Known for ${author.knownFor}` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="shrink-0 text-[13px] text-muted">{plural(author.bookCount, "title")}</span>
    </li>
  );
}

export function ListResult({ list }: { list: ListHit }) {
  return (
    <li className="border-b border-hair py-4 last:border-b-0">
      <Link href={`/list/${list.id}`} className="font-semibold leading-snug hover:underline">{list.title}</Link>
      <p className="mt-0.5 text-[13px] text-muted">
        {plural(list.itemCount, "title")} · by{" "}
        <Link href={`/user/${list.username}`} className="hover:text-cobalt">{list.displayName}</Link>
        {list.likeCount > 0 ? ` · ${list.likeCount} likes` : ""}
      </p>
      {list.description && <p className="mt-1.5 line-clamp-2 text-[14px] text-ink-2">{list.description}</p>}
    </li>
  );
}

/** Section heading used on the find page; the optional link opens the full, paginated list. */
export function ResultSection({ id, title, count, moreHref, moreLabel, children }: {
  id: string; title: string; count: number; moreHref?: string; moreLabel?: string; children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-hair pb-3">
        <h2 id={id} className="sec-title text-[20px]">
          {title} <span className="ml-1 text-base font-medium text-muted">{count.toLocaleString("en-US")}</span>
        </h2>
        {moreHref && (
          <Link href={moreHref} className="text-[13px] font-semibold text-cobalt hover:underline">{moreLabel ?? "See all"} →</Link>
        )}
      </div>
      <ul>{children}</ul>
    </section>
  );
}
