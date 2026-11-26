import type { ReactNode } from "react";

/** Chart page title block: kanji accent, large title, explanatory line and optional right-hand controls. */
export function ChartHeader({ kanji, title, subtitle, children }: { kanji: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 pb-5 pt-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="lbl mb-2 font-jp text-cobalt">{kanji}</p>
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
