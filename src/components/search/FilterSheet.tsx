"use client";

import { useEffect, useId, useState } from "react";

/**
 * Filter container. On desktop it is a plain column beside the results. On phones it is a full-screen
 * sheet opened from a button; the form it wraps is submitted from the sheet's footer via `form={formId}`.
 */
export function FilterSheet({ children, formId, activeCount }: { children: React.ReactNode; formId: string; activeCount: number }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn btn-outline mb-4 w-full md:hidden"
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-labelledby={open ? titleId : undefined}
        className={
          open
            ? "fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper md:static md:z-auto md:block md:overflow-visible md:bg-transparent"
            : "hidden md:block"
        }
      >
        <div className={`flex items-center justify-between border-b border-hair px-4 py-3 md:hidden ${open ? "" : "hidden"}`}>
          <h2 id={titleId} className="text-lg font-semibold">Filters</h2>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Close</button>
        </div>
        <div className="flex-1 px-4 md:px-0">{children}</div>
        <div className={`sticky bottom-0 border-t border-hair bg-paper p-4 md:hidden ${open ? "" : "hidden"}`}>
          <button type="submit" form={formId} onClick={() => setOpen(false)} className="btn btn-primary w-full">
            Show results
          </button>
        </div>
      </div>
    </>
  );
}
