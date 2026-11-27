"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookCover } from "@/components/book/BookCover";
import { clearRecent, readRecent, subscribeRecent, type RecentBook } from "./store";

/** IMDb's "Recently viewed" strip above the footer. Hidden on the homepage and when the history is empty. */
export function RecentlyViewed() {
  const pathname = usePathname();
  const [items, setItems] = useState<RecentBook[]>([]);
  useEffect(() => {
    const sync = () => setItems(readRecent());
    sync();
    return subscribeRecent(sync);
  }, []);

  if (pathname === "/" || items.length === 0) return null;
  // On a book page, don't list the book you're looking at first.
  const current = pathname.startsWith("/book/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;
  const shown = items.filter((b) => b.id !== current);
  if (!shown.length) return null;

  return (
    <section aria-labelledby="recent-h" className="page border-t border-hair py-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="recent-h" className="sec-title">Recently viewed</h2>
        <button type="button" onClick={clearRecent} className="lbl text-cobalt hover:underline">Clear all</button>
      </div>
      <ul className="rail relative pb-2" aria-label="Recently viewed books">
        {shown.map((b) => (
          <li key={b.id} className="w-[96px] shrink-0">
            <Link href={`/book/${b.id}`} className="group block">
              <BookCover book={b} size="S" className="shadow-card" />
              <p className="mt-2 line-clamp-2 text-[12.5px] font-semibold leading-snug group-hover:underline">{b.title}</p>
              {b.year && <p className="text-[11.5px] text-muted">{b.year}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
