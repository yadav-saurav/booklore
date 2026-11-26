"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setShelf } from "@/app/actions/engagement";

type Status = "want" | "reading" | "read";
const OPTIONS: [string, string][] = [
  ["want", "Want to Read"],
  ["reading", "Currently Reading"],
  ["read", "Read"],
  ["remove", "Remove from list"],
];

/** Move a book between shelves or remove it. The row leaves the current tab after refresh. */
export function ShelfSelect({ bookId, title, status, redirectTo = "/readinglist", className = "w-auto min-w-[11rem]" }: {
  bookId: string; title: string; status: Status; redirectTo?: string; className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(status);
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`Move ${title} to`}
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        start(async () => {
          const r = await setShelf(bookId, next === "remove" ? null : (next as Status));
          if (!r.ok && r.error === "auth") router.push(`/signin?next=${encodeURIComponent(redirectTo)}`);
          else if (!r.ok) setValue(status);
          else router.refresh();
        });
      }}
      className={`field h-9 py-0 pr-8 text-[13px] disabled:opacity-60 ${className}`}
    >
      {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
