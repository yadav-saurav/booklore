import { hash01 } from "@/lib/util";

/**
 * Deterministic screen-print style cover (duotone ink / cobalt / vermilion / cream), used whenever a
 * real cover is missing or fails to load. Pure SVG, no client JS, scales to any size.
 */
const PALETTES = [
  { bg: "#EFE6D2", a: "#1F3FB0", b: "#C8452B", ink: "#141414" },
  { bg: "#1F3FB0", a: "#EFE6D2", b: "#C8452B", ink: "#EFE6D2" },
  { bg: "#C8452B", a: "#EFE6D2", b: "#141414", ink: "#EFE6D2" },
  { bg: "#141414", a: "#C8452B", b: "#EFE6D2", ink: "#EFE6D2" },
  { bg: "#E4D9BF", a: "#141414", b: "#1F3FB0", ink: "#141414" },
  { bg: "#2B4A3A", a: "#EFE6D2", b: "#E2A21B", ink: "#EFE6D2" },
];

export function GeneratedCover({ id, title, author, className }: { id: string; title: string; author?: string | null; className?: string }) {
  const h = hash01(id);
  const p = PALETTES[Math.floor(h * PALETTES.length)];
  const motif = Math.floor(hash01(id + "m") * 4);
  const words = title.toUpperCase().split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 11) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  const shown = lines.slice(0, 4);
  const fs = shown.some((l) => l.length > 9) ? 26 : 32;
  const pat = `ht-${id.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={`${title} cover`}>
      <defs>
        <pattern id={pat} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="1.4" fill={p.a} />
        </pattern>
      </defs>
      <rect width="200" height="300" fill={p.bg} />
      {motif === 0 && <circle cx="100" cy="190" r="70" fill={`url(#${pat})`} />}
      {motif === 1 && <path d="M0 300 L0 210 Q100 140 200 210 L200 300Z" fill={`url(#${pat})`} />}
      {motif === 2 && <rect x="30" y="140" width="140" height="120" fill={`url(#${pat})`} />}
      {motif === 3 && <path d="M100 120 L170 270 L30 270Z" fill={`url(#${pat})`} />}
      <circle cx={60 + h * 80} cy="200" r="16" fill={p.b} />
      <text x="14" y="24" fontFamily="var(--font-inter-tight), sans-serif" fontSize="8" letterSpacing="1.6" fill={p.ink} fontWeight="600">
        BOOKLORE ARCHIVE
      </text>
      {shown.map((l, i) => (
        <text key={i} x="14" y={58 + i * (fs + 2)} fontFamily="var(--font-newsreader), Georgia, serif" fontWeight="700" fontSize={fs} fill={p.ink} letterSpacing="-0.5">
          {l}
        </text>
      ))}
      {author && (
        <text x="14" y="286" fontFamily="var(--font-inter-tight), sans-serif" fontSize="9" letterSpacing="1.4" fill={p.ink} fontWeight="600">
          {author.toUpperCase().slice(0, 30)}
        </text>
      )}
    </svg>
  );
}
