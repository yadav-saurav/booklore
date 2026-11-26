"use client";

import { useActionState } from "react";
import { createList, updateList, type ListFormState } from "@/app/actions/lists";

/** Title, description and visibility. Without listId it creates a list; with it, it saves changes. */
export function ListForm({ listId, initial }: { listId?: number; initial?: { title: string; description: string; isPublic: boolean } }) {
  const action = (prev: ListFormState, form: FormData) => (listId ? updateList(listId, prev, form) : createList(prev, form));
  const [state, formAction, pending] = useActionState(action, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="list-title" className="lbl text-ink-2">Title</label>
        <input id="list-title" name="title" required maxLength={120} defaultValue={f.title ?? initial?.title ?? ""}
          placeholder="Quiet books for long winter nights" className="field h-11 text-[15px]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="list-desc" className="lbl text-ink-2">Description</label>
        <textarea id="list-desc" name="description" rows={3} maxLength={500} defaultValue={f.description ?? initial?.description ?? ""}
          placeholder="What ties these books together?" className="field" />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-[14px]">
        <input type="checkbox" name="isPublic" defaultChecked={initial ? initial.isPublic : true}
          className="mt-1 h-4 w-4 accent-[var(--cobalt)]" />
        <span>
          <span className="font-semibold">Public list</span>
          <span className="block text-[13px] text-muted">Anyone can find and like it. Turn off to keep it to yourself.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "Saving…" : listId ? "Save details" : "Create list"}
        </button>
        {state?.error && <p role="alert" className="text-[14px] text-vermilion">{state.error}</p>}
        {state?.saved && <p role="status" className="text-[14px] text-up">Saved.</p>}
      </div>
    </form>
  );
}
