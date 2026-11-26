import { hash01 } from "@/lib/util";

/**
 * Generated book spine (about 1:6, viewBox 142×840 to match the shelf face): worn cardboard or cloth in the
 * archive palette, a small screen-print motif at the top, the title set vertically in a compressed serif,
 * the author's surname and a boxed "BL" mark. Deterministic per book id.
 */
const PALETTES = [
  { bg: "#C9B48F", fg: "#141414", ac: "#C8452B" }, // kraft cardboard
  { bg: "#EFE6D2", fg: "#1F3FB0", ac: "#C8452B" }, // cream
  { bg: "#1F3FB0", fg: "#EFE6D2", ac: "#E07A4F" }, // cobalt cloth
  { bg: "#C8452B", fg: "#F3ECDC", ac: "#141414" }, // vermilion
  { bg: "#1C1B19", fg: "#EFE6D2", ac: "#C8452B" }, // ink
  { bg: "#A88B62", fg: "#F3ECDC", ac: "#1F3FB0" }, // dark kraft
  { bg: "#DAD3C1", fg: "#141414", ac: "#1F3FB0" }, // pale linen
  { bg: "#2F4A3B", fg: "#EFE6D2", ac: "#E2A21B" }, // bottle green
];

function Motif({ kind, fg, ac }: { kind: number; fg: string; ac: string }) {
  // drawn inside a 106×106 box at (18, 30)
  switch (kind) {
    case 0: // sun over horizon
      return (
        <g>
          <circle cx="71" cy="78" r="26" fill={ac} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x="20" y={98 + i * 9} width="102" height="3.5" fill={fg} />)}
        </g>
      );
    case 1: // mountains
      return (
        <g>
          <path d="M18 132 L56 62 L78 100 L96 76 L124 132 Z" fill={fg} />
          <path d="M56 62 L66 80 L60 78 L52 84 Z" fill={ac} />
          <circle cx="104" cy="52" r="9" fill={ac} />
        </g>
      );
    case 2: // waves
      return (
        <g fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round">
          {[0, 1, 2].map((i) => <path key={i} d={`M20 ${70 + i * 22} q 13 -14 26 0 t 26 0 t 26 0 t 26 0`} />)}
          <circle cx="98" cy="44" r="10" fill={ac} stroke="none" />
        </g>
      );
    case 3: // bird
      return (
        <g>
          <path d="M22 96 Q52 58 72 86 Q92 58 122 96 Q92 76 72 104 Q52 76 22 96 Z" fill={fg} />
          <circle cx="72" cy="48" r="11" fill={ac} />
        </g>
      );
    case 4: // crescent moon and stars
      return (
        <g>
          <circle cx="66" cy="82" r="32" fill={fg} />
          <circle cx="80" cy="72" r="28" fill="var(--sp-bg)" />
          <circle cx="108" cy="50" r="4" fill={ac} />
          <circle cx="100" cy="114" r="3" fill={ac} />
        </g>
      );
    default: // tree
      return (
        <g>
          <path d="M71 36 L104 92 L84 92 L110 128 L32 128 L58 92 L38 92 Z" fill={fg} />
          <rect x="66" y="126" width="10" height="10" fill={ac} />
        </g>
      );
  }
}

export function SpineArt({ id, title, author }: { id: string; title: string; author: string }) {
  const p = PALETTES[Math.floor(hash01(id) * PALETTES.length)];
  const motif = Math.floor(hash01(`${id}:m`) * 6);
  const surname = (author.split(",")[0].trim().split(/\s+/).pop() ?? "").toUpperCase();
  const t = title.replace(/\s*\(.*?\)\s*/g, " ").trim().toUpperCase();

  // Title fits a 440-unit column; compress glyphs (textLength) and shrink type for long titles.
  const AVAIL = 440;
  let fs = 60;
  let est = t.length * fs * 0.52;
  if (est > AVAIL * 1.7) { fs = Math.max(30, (fs * AVAIL * 1.7) / est); est = t.length * fs * 0.52; }
  const titleLen = est > AVAIL ? AVAIL : undefined;

  const sEst = surname.length * 20 * 0.72;
  const surnameLen = sEst > 112 ? 112 : undefined;
  const wear = hash01(`${id}:w`);

  return (
    <svg viewBox="0 0 142 840" preserveAspectRatio="none" aria-hidden style={{ ["--sp-bg" as string]: p.bg }}>
      <rect width="142" height="840" fill={p.bg} />
      {/* scuffs */}
      <rect x={10 + wear * 90} y="0" width="14" height="840" fill="#fff" opacity="0.05" />
      <rect x="0" y={200 + wear * 400} width="142" height="60" fill="#000" opacity="0.05" />
      {/* head & tail bands */}
      <rect x="0" y="12" width="142" height="2.5" fill={p.fg} opacity="0.85" />
      <rect x="0" y="826" width="142" height="2.5" fill={p.fg} opacity="0.85" />
      <g transform="translate(0 0)"><Motif kind={motif} fg={p.fg} ac={p.ac} /></g>
      <rect x="18" y="152" width="106" height="1.5" fill={p.fg} opacity="0.8" />
      <text
        transform="translate(71 172) rotate(90)"
        dominantBaseline="central"
        fontFamily="var(--font-newsreader), Georgia, serif"
        fontWeight="700"
        fontSize={fs}
        letterSpacing="-0.5"
        fill={p.fg}
        textLength={titleLen}
        lengthAdjust={titleLen ? "spacingAndGlyphs" : undefined}
      >
        {t}
      </text>
      <text
        transform="translate(71 642) rotate(90)"
        dominantBaseline="central"
        fontFamily="var(--font-inter-tight), sans-serif"
        fontWeight="600"
        fontSize="20"
        letterSpacing="4"
        fill={p.fg}
        textLength={surnameLen}
        lengthAdjust={surnameLen ? "spacingAndGlyphs" : undefined}
      >
        {surname}
      </text>
      <rect x="44" y="772" width="54" height="36" fill="none" stroke={p.fg} strokeWidth="2.5" />
      <text x="71" y="791" textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-inter-tight), sans-serif" fontWeight="700" fontSize="19" letterSpacing="2" fill={p.fg}>
        BL
      </text>
    </svg>
  );
}
