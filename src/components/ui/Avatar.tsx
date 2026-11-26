/** Monogram avatar on a hue derived from the user (no uploads needed). */
export function Avatar({ name, hue = 220, size = 40, className = "" }: { name: string; hue?: number; size?: number; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 45% 88%)`, color: `hsl(${hue} 60% 28%)` }}
    >
      {initials}
    </span>
  );
}
