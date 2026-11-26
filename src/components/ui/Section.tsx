import Link from "next/link";

/** IMDb section header: accent bar, title, optional count + chevron link, optional subtitle. */
export function SectionHeader({ title, href, subtitle, count, kanji, as: Tag = "h2" }: {
  title: string; href?: string; subtitle?: string; count?: number; kanji?: string; as?: "h1" | "h2" | "h3";
}) {
  const inner = (
    <>
      <span>{title}</span>
      {count !== undefined && <span className="text-base font-medium text-muted">{count.toLocaleString("en-US")}</span>}
      {href && (
        <svg viewBox="0 0 12 24" className="h-5 w-2.5 text-ink transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4l8 8-8 8" />
        </svg>
      )}
    </>
  );
  return (
    <div className="mb-4">
      {kanji && <p className="lbl mb-2 font-jp text-cobalt">{kanji}</p>}
      <Tag className="sec-title">
        {href ? <Link href={href} className="group inline-flex items-center gap-3 hover:text-cobalt">{inner}</Link> : inner}
      </Tag>
      {subtitle && <p className="mt-1.5 pl-4 text-[15px] text-muted">{subtitle}</p>}
    </div>
  );
}

export function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`py-7 ${className}`}>{children}</section>;
}
