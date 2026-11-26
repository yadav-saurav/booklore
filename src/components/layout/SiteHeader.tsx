"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { MenuDrawer } from "./MenuDrawer";
import { UserMenu } from "./UserMenu";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-4 text-cobalt" aria-label="BOOKLORE home">
      <span className="text-[15px] font-semibold uppercase leading-none tracking-[0.2em]">Booklore</span>
      {!compact && (
        <>
          <span className="h-px w-10 bg-current" aria-hidden />
          <span className="lbl hidden sm:inline">Book Archive</span>
        </>
      )}
    </Link>
  );
}

function Burger({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Open menu" className="flex h-10 items-center gap-2.5 px-1 text-cobalt">
      <span className="flex h-3 w-[26px] flex-col justify-between" aria-hidden>
        <span className="h-[1.5px] w-full bg-current" />
        <span className="h-[1.5px] w-full bg-current" />
      </span>
      <span className="lbl hidden lg:inline">Menu</span>
    </button>
  );
}

/**
 * Global header. Two dresses:
 *  - "archive" on the homepage: transparent 76px bar over the shelf hero (reference layout).
 *  - default everywhere else: sticky paper bar with IMDb's full search field.
 */
export function SiteHeader({ user, listCount }: { user: SessionUser | null; listCount: number }) {
  const pathname = usePathname();
  const archive = pathname === "/";
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => { setMenu(false); setSearchOpen(false); }, [pathname]);

  if (archive) {
    return (
      <>
        <header className="absolute inset-x-0 top-0 z-50 flex h-[60px] items-center justify-between px-4 text-cobalt md:h-[76px] md:px-9">
          <Brand />
          <nav className="flex items-center gap-5 md:gap-[34px]" aria-label="Primary">
            <Link href="/genres" className="lbl hidden hover:underline md:inline">Browse</Link>
            <Link href="/chart/top" className="lbl hidden hover:underline md:inline">Charts</Link>
            <Link href="/lists" className="lbl hidden hover:underline md:inline">Lists</Link>
            <button type="button" onClick={() => setSearchOpen(true)} className="lbl flex items-center gap-2 hover:underline" aria-label="Search">
              <SearchGlyph /> <span className="hidden md:inline">Search</span>
            </button>
            {user ? <UserMenu user={user} listCount={listCount} archive /> : <Link href="/signin" className="lbl hidden hover:underline sm:inline">Sign in</Link>}
            <Burger onClick={() => setMenu(true)} />
          </nav>
        </header>
        {searchOpen && (
          <div className="fixed inset-x-0 top-0 z-[70] border-b border-hair bg-sheet/95 px-4 py-3 backdrop-blur md:px-9">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <SearchBox autoFocus />
              <button type="button" className="lbl box text-muted" onClick={() => setSearchOpen(false)}>Close</button>
            </div>
          </div>
        )}
        <MenuDrawer open={menu} onClose={() => setMenu(false)} />
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hair bg-paper/92 backdrop-blur-md">
        <div className="page flex h-14 items-center gap-2 md:h-[60px] md:gap-4">
          <div className="md:hidden"><Burger onClick={() => setMenu(true)} /></div>
          <Brand compact />
          <div className="hidden md:block"><Burger onClick={() => setMenu(true)} /></div>
          <div className="hidden flex-1 md:block"><SearchBox /></div>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button type="button" onClick={() => setSearchOpen((v) => !v)} className="flex h-10 w-10 items-center justify-center text-cobalt md:hidden" aria-label="Search">
              <SearchGlyph />
            </button>
            <Link href="/readinglist" className="btn btn-ghost hidden px-3 sm:inline-flex">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-cobalt" aria-hidden><path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              Reading List
              {listCount > 0 && <span className="rounded-full bg-cobalt px-1.5 text-[11px] leading-[18px] text-cobalt-ink">{listCount}</span>}
            </Link>
            {user ? <UserMenu user={user} listCount={listCount} /> : <Link href="/signin" className="btn btn-ghost px-3">Sign in</Link>}
          </div>
        </div>
        {searchOpen && <div className="page pb-3 md:hidden"><SearchBox autoFocus /></div>}
      </header>
      <MenuDrawer open={menu} onClose={() => setMenu(false)} />
    </>
  );
}

export function SearchGlyph({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" strokeLinecap="round" />
    </svg>
  );
}
