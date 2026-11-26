"use client";

import { useState, useTransition } from "react";
import { deleteList } from "@/app/actions/lists";

export function DeleteListButton({ listId }: { listId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!confirming) {
    return <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost btn-sm text-down">Delete list</button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[14px]">Delete this list for good?</span>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteList(listId); if (!r.ok) setError(r.error); })}
        className="btn btn-sm h-9 border border-down px-3 text-down hover:bg-down/10 disabled:opacity-60">
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">Keep it</button>
      {error && <span role="alert" className="text-[13px] text-vermilion">{error}</span>}
    </div>
  );
}
