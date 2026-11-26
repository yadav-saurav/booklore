/** Build a query string from an object, dropping empty and undefined values. */
export function qs(params: Record<string, string | number | undefined | null | false>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}
