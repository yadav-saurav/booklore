"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try { setMode((localStorage.getItem("bl-theme") as Mode) || "system"); } catch { /* storage blocked */ }
  }, []);
  const apply = (m: Mode) => {
    setMode(m);
    const root = document.documentElement;
    if (m === "system") { delete root.dataset.theme; try { localStorage.removeItem("bl-theme"); } catch {} }
    else { root.dataset.theme = m; try { localStorage.setItem("bl-theme", m); } catch {} }
  };
  return (
    <div className="flex items-center border border-hair" role="group" aria-label="Colour theme">
      {(["light", "system", "dark"] as Mode[]).map((m) => (
        <button key={m} type="button" onClick={() => apply(m)} aria-pressed={mode === m}
          className={`lbl h-[26px] px-2.5 ${mode === m ? "bg-cobalt text-cobalt-ink" : "text-muted hover:text-ink"}`}>
          {m === "system" ? "Auto" : m}
        </button>
      ))}
    </div>
  );
}
