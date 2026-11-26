import { sqlite } from "@/db";

const UA = "BOOKLORE/0.1 (book discovery app)";

/** GET JSON with timeout, and a SQLite-backed TTL cache shared by all providers. */
export async function cachedJson<T>(url: string, ttlSeconds = 60 * 60 * 24, timeoutMs = 8000): Promise<T | null> {
  const key = `http:${url}`;
  const now = Math.floor(Date.now() / 1000);
  const hit = sqlite.prepare(`SELECT value, expires_at FROM api_cache WHERE key = ?`).get(key) as
    | { value: string; expires_at: number }
    | undefined;
  if (hit && hit.expires_at > now) return JSON.parse(hit.value) as T;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = (await res.json()) as T;
    sqlite
      .prepare(`INSERT INTO api_cache (key, value, expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at`)
      .run(key, JSON.stringify(data), now + ttlSeconds);
    return data;
  } catch (err) {
    // Serve stale data rather than nothing when the remote is down or rate-limited.
    if (hit) return JSON.parse(hit.value) as T;
    console.warn(`[providers] ${url} failed:`, (err as Error).message);
    return null;
  }
}
