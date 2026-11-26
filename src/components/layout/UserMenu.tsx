"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/Avatar";

export function UserMenu({ user, listCount, archive }: { user: SessionUser; listCount: number; archive?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        className={archive ? "lbl flex items-center gap-2 text-cobalt hover:underline" : "btn btn-ghost px-2"}>
        <Avatar name={user.displayName} hue={user.avatarHue} size={archive ? 22 : 28} />
        <span className="hidden max-w-[10ch] truncate lg:inline">{user.displayName.split(" ")[0]}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-[80] w-56 border border-hair bg-sheet py-2 text-[14px] text-ink shadow-card">
          {[
            ["Your profile", `/user/${user.username}`],
            [`Your Reading List${listCount ? ` (${listCount})` : ""}`, "/readinglist"],
            ["Your ratings", "/you/ratings"],
            ["Your lists", `/user/${user.username}/lists`],
            ["Recommendations", "/recommendations"],
            ["Account settings", "/settings"],
          ].map(([label, href]) => (
            <Link key={href} role="menuitem" href={href} onClick={() => setOpen(false)} className="block px-4 py-2 hover:bg-cobalt-soft hover:text-cobalt">
              {label}
            </Link>
          ))}
          <form action={signOut} className="mt-1 border-t border-hair pt-1">
            <button type="submit" role="menuitem" className="block w-full px-4 py-2 text-left hover:bg-cobalt-soft hover:text-cobalt">Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
