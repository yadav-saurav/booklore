"use client";

import { useState } from "react";

/** Serif biography clamped to a few lines with a "Read more" toggle. */
export function BioClamp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320;
  return (
    <div className="max-w-[68ch]">
      <p className={`prose-serif whitespace-pre-line text-ink-2 ${long && !open ? "line-clamp-4" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="mt-2 text-[13px] font-semibold text-cobalt hover:underline">
          {open ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
