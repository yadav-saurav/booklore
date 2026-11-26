import Link from "next/link";

const TABS = [
  { href: "/chart/top", label: "BOOKLORE Top 250", key: "top" },
  { href: "/chart/bookmeter", label: "Most Popular", key: "bookmeter" },
  { href: "/chart/new", label: "New & Notable", key: "new" },
] as const;

/** Tab strip shared by the three charts (IMDb's chart sub-navigation). */
export function ChartTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav aria-label="Charts" className="border-b border-rule">
      <ul className="page flex gap-1 overflow-x-auto whitespace-nowrap">
        {TABS.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={`relative block px-3 py-3.5 text-[14px] font-semibold transition-colors ${
                t.key === active ? "text-cobalt" : "text-ink-2 hover:text-cobalt"
              }`}
            >
              {t.label}
              {t.key === active && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-cobalt" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
