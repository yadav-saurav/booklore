/** Build a same-site href from a path and params. Empty, null and undefined values are dropped. */
export function buildHref(path: string, params: Record<string, string | number | boolean | null | undefined> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "" || v === false) continue;
    sp.set(k, v === true ? "1" : String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
