import Link from "next/link";

export type ChipItem = { label: string; href: string; active?: boolean };

/** Horizontal, scroll-on-mobile row of filter chips. Chips are plain links so filters work without JS. */
export function ChipRow({ label, items }: { label: string; items: ChipItem[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="lbl shrink-0 text-muted sm:w-20">{label}</span>
      <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <Link key={it.label} href={it.href} data-active={!!it.active} aria-current={it.active ? "true" : undefined}
            className="chip shrink-0 whitespace-nowrap">
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
