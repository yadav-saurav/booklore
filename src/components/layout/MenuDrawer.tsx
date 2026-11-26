"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ThemeToggle } from "./ThemeToggle";

const GROUPS: { title: string; kanji: string; links: [string, string][] }[] = [
  { title: "Books", kanji: "本", links: [["Top 250 Books", "/chart/top"], ["Most Popular (BookMeter)", "/chart/bookmeter"], ["New & Notable", "/chart/new"], ["Browse by Genre", "/genres"], ["Advanced Search", "/search/advanced"]] },
  { title: "Authors", kanji: "作家", links: [["Popular Authors", "/authors"], ["Born Today", "/authors?born=today"]] },
  { title: "For You", kanji: "推薦", links: [["Recommendations", "/recommendations"], ["Your Reading List", "/readinglist"], ["Your Ratings", "/you/ratings"]] },
  { title: "Community", kanji: "共同体", links: [["Reader Lists", "/lists"], ["Latest Reviews", "/reviews"], ["Top Reviewers", "/community"]] },
];

/** Full-screen menu (IMDb's mega menu), revealed with a clip-path wipe – no opacity fades. */
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      aria-hidden={!open}
      inert={!open}
      className="fixed inset-0 z-[90] overflow-y-auto bg-sheet text-ink transition-[clip-path] duration-700 ease-[cubic-bezier(.76,0,.18,1)]"
      style={{ clipPath: open ? "inset(0 0 0 0)" : "inset(0 0 100% 0)" }}
    >
      <div className="page flex h-[60px] items-center justify-between md:h-[76px]">
        <Link href="/" onClick={onClose} className="text-[15px] font-semibold uppercase tracking-[0.2em] text-cobalt">Booklore</Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button type="button" onClick={onClose} className="lbl box text-ink">Close / 閉じる</button>
        </div>
      </div>
      <nav className="page grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4" aria-label="All sections">
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            <p className="lbl font-jp text-cobalt">{g.kanji}</p>
            <h2 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight">
              <span className="h-6 w-1 bg-cobalt" aria-hidden />
              {g.title}
            </h2>
            <ul className="mt-4 space-y-1">
              {g.links.map(([label, href], i) => (
                <li key={href} className="mask">
                  <Link href={href} onClick={onClose}
                    className="block py-1.5 text-[17px] text-ink-2 transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] hover:text-cobalt hover:underline"
                    style={{ transform: open ? "none" : "translateY(110%)", transitionDelay: open ? `${250 + gi * 60 + i * 40}ms` : "0ms" }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
