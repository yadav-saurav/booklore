import Link from "next/link";
import { QuerySelect } from "./QuerySelect";

/** Shared sort / genre / view controls for list pages. Params are plain query strings, so pages stay server-rendered. */
export function SortToolbar({ base, sort, sortOptions, genre, genreOptions, view, params }: {
  base?: string; sort: string; sortOptions: [string, string][]; genre: string; genreOptions: [string, string][];
  view?: "list" | "grid"; params: Record<string, string | undefined>;
}) {
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return `${base ?? ""}${s ? `?${s}` : ""}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-hair py-3">
      <QuerySelect name="sort" label="Sort by" value={sort} options={sortOptions} params={{ ...params, sort: undefined }} />
      <QuerySelect name="genre" label="Genre" value={genre} options={genreOptions} params={{ ...params, genre: undefined }} />
      {view && (
        <nav aria-label="View" className="ml-auto flex items-center gap-1">
          {(["list", "grid"] as const).map((v) => (
            <Link key={v} href={href({ view: v })} aria-current={view === v ? "true" : undefined}
              className="chip" data-active={view === v}>
              {v === "list" ? "List" : "Grid"}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
