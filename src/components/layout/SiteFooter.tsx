"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteFooter() {
  const home = usePathname() === "/";
  return (
    <footer className={`border-t border-hair ${home ? "" : "mt-16"}`}>
      <div className="page py-12 text-center">
        <nav className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-[14px] font-semibold" aria-label="Footer">
          {[["Top 250", "/chart/top"], ["BookMeter", "/chart/bookmeter"], ["Genres", "/genres"], ["Authors", "/authors"], ["Lists", "/lists"], ["Advanced Search", "/search/advanced"], ["About", "/about"]].map(([l, h]) => (
            <Link key={h} href={h} className="hover:text-cobalt hover:underline">{l}</Link>
          ))}
        </nav>
        <p className="lbl mt-8 text-cobalt">Booklore <span className="font-jp">本の記憶</span></p>
        <p className="mt-3 text-[12px] text-muted">
          Book data from{" "}
          <a href="https://openlibrary.org" className="underline hover:text-cobalt" target="_blank" rel="noreferrer">Open Library</a> and{" "}
          <a href="https://books.google.com" className="underline hover:text-cobalt" target="_blank" rel="noreferrer">Google Books</a>.
          Ratings, reviews and members shown in this preview are sample data.
        </p>
        <p className="lbl mt-4 text-[9.5px] text-muted">© {new Date().getFullYear()} Booklore. All rights reserved.</p>
      </div>
    </footer>
  );
}
