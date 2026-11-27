"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ShelfStatus } from "@/db/schema";
import { listHref, refineCount, SORT_LABELS, STATUS_LABELS, type ListState, type SortKey, type TitleView } from "./params";

const MIN_RATINGS = [6, 7, 8, 9];

/**
 * IMDb list toolbar: "N titles", Refine (filter drawer with applied count), Sort by + ↑↓ toggle,
 * and the Detailed / Grid / Compact switcher. Optional status chips (Reading List). State lives in the URL.
 */
export function ListToolbar({
  state, sorts, defaultSort, count, total, genres, statusChips, naturalDir, scoreLabel,
}: {
  state: ListState; sorts: SortKey[]; defaultSort: SortKey; count: number; total: number;
  genres: { slug: string; name: string; count: number }[];
  statusChips?: { counts: Record<ShelfStatus, number> } | null;
  naturalDir: "asc" | "desc"; scoreLabel?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const go = (patch: Partial<ListState>) => start(() => router.push(listHref(path, state, patch, defaultSort), { scroll: false }));
  const dir = state.dir ?? naturalDir;
  const n = refineCount(state);

  return (
    <div className={`border-b border-hair ${pending ? "[&_*]:cursor-wait" : ""}`} aria-busy={pending}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4">
        <p className="text-[15px] text-ink-2" aria-live="polite">
          <span className="font-semibold text-ink">{count.toLocaleString("en-US")}</span> {count === 1 ? "title" : "titles"}
          {count !== total && <span className="text-muted"> of {total.toLocaleString("en-US")}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
            className="btn btn-sm btn-outline gap-2">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M2 4h12M4.5 8h7M7 12h2" strokeLinecap="round" /></svg>
            <span className="max-sm:sr-only">Refine</span>
            {n > 0 && <span className="rounded-full bg-cobalt px-1.5 text-[11px] leading-[18px] text-cobalt-ink">{n}</span>}
          </button>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <span className="max-sm:sr-only">Sort by</span>
            <select value={state.sort} onChange={(e) => go({ sort: e.target.value as SortKey, dir: null })}
              className="field h-8 w-auto max-w-[140px] cursor-pointer py-0 pr-7 text-[13px] font-semibold text-ink sm:max-w-none">
              {sorts.map((s) => <option key={s} value={s}>{s === "order" ? orderLabel(path) : SORT_LABELS[s]}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => go({ dir: dir === "asc" ? "desc" : "asc" })}
            className="btn btn-sm btn-ghost h-8 w-8 px-0 text-cobalt" aria-label={`Sort direction: ${dir === "asc" ? "ascending" : "descending"}. Reverse`}
            title={dir === "asc" ? "Ascending" : "Descending"}>
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M6 3v14M3 6l3-3 3 3" className={dir === "asc" ? "" : "opacity-35"} />
              <path d="M14 17V3M11 14l3 3 3-3" className={dir === "desc" ? "" : "opacity-35"} />
            </svg>
          </button>
          <div className="flex border border-hair" role="group" aria-label="View">
            {(["detailed", "grid", "compact"] as TitleView[]).map((v) => (
              <button key={v} type="button" onClick={() => go({ view: v })} aria-pressed={state.view === v} aria-label={`${v[0].toUpperCase()}${v.slice(1)} view`} title={`${v[0].toUpperCase()}${v.slice(1)} view`}
                className={`flex h-8 w-9 items-center justify-center transition-colors ${state.view === v ? "bg-cobalt text-cobalt-ink" : "text-ink-2 hover:bg-hair-2"}`}>
                <ViewIcon v={v} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {(statusChips || n > 0) && (
        <div className="-mt-1 flex flex-wrap items-center gap-2 pb-4">
          {statusChips && (
            <>
              <button type="button" className="chip" data-active={state.statuses.length === 0} onClick={() => go({ statuses: [] })}>
                All <span className="tabular-nums opacity-70">{Object.values(statusChips.counts).reduce((a, b) => a + b, 0)}</span>
              </button>
              {(Object.keys(STATUS_LABELS) as ShelfStatus[]).map((s) => (
                <button key={s} type="button" className="chip" data-active={state.statuses.includes(s)}
                  onClick={() => go({ statuses: state.statuses.includes(s) ? state.statuses.filter((x) => x !== s) : [...state.statuses, s] })}>
                  {s === "reading" ? "Currently Reading" : STATUS_LABELS[s]} <span className="tabular-nums opacity-70">{statusChips.counts[s]}</span>
                </button>
              ))}
              {n - state.statuses.length > 0 && <span className="mx-1 h-5 w-px bg-hair" aria-hidden />}
            </>
          )}
          <Applied state={state} genres={genres} path={path} defaultSort={defaultSort} skipStatus={!!statusChips} scoreLabel={scoreLabel} />
          {n > 0 && (
            <Link href={listHref(path, state, { genres: [], statuses: [], minRating: null, yearFrom: null, yearTo: null, score: null }, defaultSort)} scroll={false}
              className="ml-1 text-[13px] font-semibold text-cobalt hover:underline">Clear all</Link>
          )}
        </div>
      )}

      {open && <RefineDrawer state={state} genres={genres} withStatus={!!statusChips} onClose={() => setOpen(false)} onApply={(p) => { setOpen(false); go(p); }} />}
    </div>
  );
}

function orderLabel(path: string) {
  return path.startsWith("/list/") ? "List order" : path.startsWith("/you/ratings") ? "Date rated" : "Date added";
}

function Applied({ state, genres, path, defaultSort, skipStatus, scoreLabel }: {
  state: ListState; genres: { slug: string; name: string }[]; path: string; defaultSort: SortKey; skipStatus: boolean; scoreLabel?: string;
}) {
  const chips: { label: string; patch: Partial<ListState> }[] = [];
  for (const g of state.genres) chips.push({ label: genres.find((x) => x.slug === g)?.name ?? g, patch: { genres: state.genres.filter((x) => x !== g) } });
  if (!skipStatus) for (const s of state.statuses) chips.push({ label: STATUS_LABELS[s], patch: { statuses: state.statuses.filter((x) => x !== s) } });
  if (state.minRating) chips.push({ label: `★ ${state.minRating}+`, patch: { minRating: null } });
  if (state.yearFrom || state.yearTo) chips.push({ label: `${state.yearFrom ?? "…"}–${state.yearTo ?? "…"}`, patch: { yearFrom: null, yearTo: null } });
  if (state.score) chips.push({ label: `${scoreLabel ?? "Your rating"}: ${state.score}`, patch: { score: null } });
  return (
    <>
      {chips.map((c) => (
        <Link key={c.label} href={listHref(path, state, c.patch, defaultSort)} scroll={false} className="chip border-cobalt/50 bg-cobalt-soft text-cobalt" aria-label={`Remove filter ${c.label}`}>
          {c.label}
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" /></svg>
        </Link>
      ))}
    </>
  );
}

function RefineDrawer({ state, genres, withStatus, onClose, onApply }: {
  state: ListState; genres: { slug: string; name: string; count: number }[]; withStatus: boolean;
  onClose: () => void; onApply: (p: Partial<ListState>) => void;
}) {
  const [g, setG] = useState<string[]>(state.genres);
  const [st, setSt] = useState<ShelfStatus[]>(state.statuses);
  const [min, setMin] = useState<number | null>(state.minRating);
  const [from, setFrom] = useState(state.yearFrom ? String(state.yearFrom) : "");
  const [to, setTo] = useState(state.yearTo ? String(state.yearTo) : "");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const yr = (s: string) => { const n = Number(s); return s && Number.isInteger(n) && n > 0 && n < 3000 ? n : null; };
  const pending = g.length + st.length + (min ? 1 : 0) + (yr(from) || yr(to) ? 1 : 0);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="refine-h">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Close filters" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col bg-sheet shadow-card md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px]">
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <h2 id="refine-h" className="sec-title text-[20px]">Refine</h2>
          <button type="button" onClick={onClose} className="lbl box text-muted hover:text-ink">Close</button>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
          {withStatus && (
            <fieldset>
              <legend className="lbl mb-3 text-muted">Status</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_LABELS) as ShelfStatus[]).map((s) => (
                  <button key={s} type="button" className="chip" data-active={st.includes(s)} aria-pressed={st.includes(s)} onClick={() => setSt(toggle(st, s))}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="lbl mb-3 text-muted">Genre</legend>
            {genres.length ? (
              <div className="flex flex-wrap gap-2">
                {genres.map((x) => (
                  <button key={x.slug} type="button" className="chip" data-active={g.includes(x.slug)} aria-pressed={g.includes(x.slug)} onClick={() => setG(toggle(g, x.slug))}>
                    {x.name} <span className="tabular-nums opacity-60">{x.count}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-[13px] text-muted">No genres on this list yet.</p>}
          </fieldset>
          <fieldset>
            <legend className="lbl mb-3 text-muted">BOOKLORE rating</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" data-active={!min} onClick={() => setMin(null)}>Any</button>
              {MIN_RATINGS.map((m) => (
                <button key={m} type="button" className="chip" data-active={min === m} aria-pressed={min === m} onClick={() => setMin(m)}>
                  <span className="text-star">★</span> {m}+
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="lbl mb-3 text-muted">Publication year</legend>
            <div className="flex items-center gap-3">
              <input className="field w-28" inputMode="numeric" placeholder="From" aria-label="From year" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} />
              <span className="text-muted" aria-hidden>–</span>
              <input className="field w-28" inputMode="numeric" placeholder="To" aria-label="To year" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </fieldset>
        </div>
        <div className="flex items-center gap-3 border-t border-hair px-5 py-4">
          <button type="button" className="btn btn-ghost" onClick={() => { setG([]); setSt([]); setMin(null); setFrom(""); setTo(""); }}>Clear</button>
          <button type="button" className="btn btn-primary ml-auto min-w-36"
            onClick={() => onApply({ genres: g, statuses: withStatus ? st : state.statuses, minRating: min, yearFrom: yr(from), yearTo: yr(to) })}>
            Apply{pending ? ` (${pending})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewIcon({ v }: { v: TitleView }) {
  if (v === "detailed")
    return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden><rect x="1" y="2" width="4" height="5" /><rect x="7" y="3" width="8" height="1.4" /><rect x="7" y="5.2" width="5" height="1.2" /><rect x="1" y="9" width="4" height="5" /><rect x="7" y="10" width="8" height="1.4" /><rect x="7" y="12.2" width="5" height="1.2" /></svg>;
  if (v === "grid")
    return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden><rect x="1" y="1" width="6" height="6" /><rect x="9" y="1" width="6" height="6" /><rect x="1" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /></svg>;
  return <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden><rect x="1" y="2" width="14" height="1.6" /><rect x="1" y="5.5" width="14" height="1.6" /><rect x="1" y="9" width="14" height="1.6" /><rect x="1" y="12.5" width="14" height="1.6" /></svg>;
}
