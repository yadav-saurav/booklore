import Link from "next/link";

export type Segment = { label: string; href: string; active: boolean; hint?: string };

/** A row of link-based toggles (sort, view, tabs). Works without JavaScript; state lives in the URL. */
export function SegmentLinks({ items, label, className = "" }: { items: Segment[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          title={it.hint}
          className={`chip ${it.active ? "" : "bg-transparent"}`}
          data-active={it.active}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
