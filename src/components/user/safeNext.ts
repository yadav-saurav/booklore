/** Only allow same-site relative paths in ?next= (blocks open redirects). */
export function safeNext(n: string | null | undefined, fallback = "/"): string {
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\")) return fallback;
  return n;
}
