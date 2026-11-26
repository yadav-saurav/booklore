import type { ReactNode } from "react";

/** Shared "nothing here" block for charts and search. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-rule/40 px-6 py-12 text-center">
      <p className="lbl mb-2 text-cobalt">Nothing here yet</p>
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <div className="mx-auto mt-2 max-w-md text-[15px] text-muted">{children}</div>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
