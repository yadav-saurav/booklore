/** Recently viewed books, kept in this browser only (localStorage). Every access is guarded. */
export type RecentBook = { id: string; title: string; coverId: number | null; coverUrl: string | null; authorName: string | null; year: number | null };

const KEY = "bl-recent";
const MAX = 12;
const EVENT = "bl-recent-change";

export function readRecent(): RecentBook[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && typeof x.title === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: RecentBook[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* storage blocked */ }
}

export function pushRecent(b: RecentBook) {
  write([b, ...readRecent().filter((x) => x.id !== b.id)]);
}

export function clearRecent() {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVENT)); } catch { /* storage blocked */ }
}

export function subscribeRecent(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
}
