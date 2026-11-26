"use client";

/** A native select that submits a GET form on change, keeping the other query params. */
export function QuerySelect({ name, label, value, options, params }: {
  name: string; label: string; value: string; options: [string, string][]; params: Record<string, string | undefined>;
}) {
  const id = `qs-${name}`;
  return (
    <form method="get" className="flex items-center gap-2">
      {Object.entries(params).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor={id} className="lbl text-muted">{label}</label>
      <select id={id} name={name} defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field h-9 w-auto min-w-[10rem] py-0 pr-8 text-[13.5px]">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <noscript><button type="submit" className="btn btn-sm btn-outline">Apply</button></noscript>
    </form>
  );
}
