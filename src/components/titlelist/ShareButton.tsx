"use client";

import { useEffect, useState } from "react";

/** IMDb "Share": copies the page link and confirms with a toast. */
export function ShareButton({ path }: { path?: string }) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t); }, [toast]);
  const share = async () => {
    const url = path ? new URL(path, location.origin).href : location.href;
    try { await navigator.clipboard.writeText(url); setToast("Link copied to clipboard"); }
    catch { setToast("Couldn't copy. Copy the address bar instead."); }
  };
  return (
    <>
      <button type="button" onClick={share} className="btn btn-ghost btn-sm gap-2 text-cobalt" aria-label="Share: copy link">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
        </svg>
        Share
      </button>
      <div role="status" aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 bg-ink px-4 py-3 text-[14px] font-medium text-paper shadow-card transition-transform duration-300 ${toast ? "translate-y-0" : "pointer-events-none translate-y-[200%]"}`}>
        {toast ?? ""}
      </div>
    </>
  );
}
