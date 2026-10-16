"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

type Opt = { value: string; label: string };
export type BulkOp = { value: string; label: string; target?: { label: string; options: Opt[] }; danger?: boolean };

const boxes = (form: string) => Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${form}"]`));

/** Header checkbox: tick or untick every row on this page that belongs to the bulk form. */
export function SelectAll({ form, label }: { form: string; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      onChange={(e) => {
        for (const b of boxes(form)) b.checked = e.target.checked;
        document.dispatchEvent(new Event("bulk-change"));
      }}
    />
  );
}

/**
 * Perfex-style bulk actions. Row checkboxes elsewhere on the page join this form with
 * `<input type="checkbox" name="ids" form={id} …>`.
 */
export function BulkBar({ id, action, noun, ops }: { id: string; action: (form: FormData) => Promise<void>; noun: string; ops: BulkOp[] }) {
  const [count, setCount] = useState(0);
  const [op, setOp] = useState("");
  useEffect(() => {
    const update = () => setCount(boxes(id).filter((b) => b.checked).length);
    document.addEventListener("change", update);
    document.addEventListener("bulk-change", update);
    return () => {
      document.removeEventListener("change", update);
      document.removeEventListener("bulk-change", update);
    };
  }, [id]);
  const current = ops.find((o) => o.value === op);

  return (
    <form
      id={id}
      action={action}
      onSubmit={(e) => {
        if (current?.danger && !window.confirm(`${current.label} ${count} ${noun}${count === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm"
    >
      <span className="mr-1 text-xs font-medium text-slate-500" aria-live="polite">{count ? `${count} selected` : `Tick ${noun}s to act on several at once`}</span>
      <select name="op" aria-label="Bulk action" value={op} onChange={(e) => setOp(e.target.value)} disabled={!count} className="field h-8 w-auto py-0 text-xs">
        <option value="">Bulk action…</option>
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {current?.target && (
        <select key={op} name="target" aria-label={current.target.label} required className="field h-8 w-auto py-0 text-xs">
          <option value="">{current.target.label}…</option>
          {current.target.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <SubmitButton size="sm" variant={current?.danger ? "danger" : "primary"} disabled={!count || !op} pendingText="Applying…">Apply</SubmitButton>
    </form>
  );
}
