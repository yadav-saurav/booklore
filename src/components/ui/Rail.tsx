"use client";

import { useEffect, useRef, useState } from "react";

/** Horizontal "shoveler" with IMDb-style paging arrows that appear on hover (desktop) and native swipe on touch. */
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <div className="group/rail relative">
      <div ref={ref} className="rail pb-2" role="list" aria-label={label}>{children}</div>
      {(["prev", "next"] as const).map((k) => {
        const hidden = k === "prev" ? edge.start : edge.end;
        return (
          <button key={k} type="button" aria-label={k === "prev" ? "Previous" : "Next"} onClick={() => page(k === "prev" ? -1 : 1)}
            className={`absolute top-[30%] z-[3] hidden h-16 w-11 items-center justify-center border border-hair bg-sheet/90 text-cobalt shadow-card backdrop-blur transition-opacity md:flex
              ${k === "prev" ? "-left-2" : "-right-2"} ${hidden ? "pointer-events-none opacity-0" : "opacity-0 group-hover/rail:opacity-100"}`}>
            <svg viewBox="0 0 24 12" className={`h-3 w-6 ${k === "next" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M6 1L1 6l5 5M1 6h23" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
