export type Params = Record<string, string | undefined>;

/** Flatten Next's searchParams (values may be arrays) to single strings. */
export function flatParams(sp: Record<string, string | string[] | undefined>): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

/** Build a URL on `path` with `current` params, overridden by `patch` (undefined/null/"" removes a key). */
export function hrefWith(path: string, current: Params, patch: Record<string, string | number | null | undefined> = {}): string {
  const merged: Record<string, string | undefined> = { ...current };
  for (const [k, v] of Object.entries(patch)) merged[k] = v === null || v === undefined ? undefined : String(v);
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}
