/**
 * Decorative kanji printed as a halftone: transparent glyphs filled with a 3×3px dot screen
 * (background-clip: text). Purely decorative, so it is hidden from assistive tech.
 */
export function HalftoneKanji({ kanji, size = 96, className = "" }: { kanji: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none select-none font-jp font-extrabold leading-none ${className}`}
      style={{
        fontSize: size,
        color: "transparent",
        backgroundImage: "radial-gradient(circle at center, var(--halftone) 0.9px, transparent 1.25px)",
        backgroundSize: "3px 3px",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
      }}
    >
      {kanji}
    </span>
  );
}
