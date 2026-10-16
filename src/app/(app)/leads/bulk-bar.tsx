"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { bulkLeads } from "./actions";

export const BULK_FORM = "bulk-leads";
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${BULK_FORM}"]`));

type Opt = { value: string; label: string };

/** Header checkbox: tick or untick every lead on this page. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Select all leads on this page"
      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      onChange={(e) => {
        for (const b of boxes()) b.checked = e.target.checked;
        document.dispatchEvent(new Event("bulk-change"));
      }}
    />
  );
}

/** Perfex-style bulk actions for the ticked leads (list view). */
export function BulkBar({ statuses, sources, staff, tags, canDelete }: { statuses: Opt[]; sources: Opt[]; staff: Opt[]; tags: Opt[]; canDelete: boolean }) {
  const [count, setCount] = useState(0);
  const [op, setOp] = useState("");
  useEffect(() => {
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    document.addEventListener("bulk-change", update);
    return () => {
      document.removeEventListener("change", update);
      document.removeEventListener("bulk-change", update);
    };
  }, []);

  const targets: Record<string, { label: string; options: Opt[] }> = {
    status: { label: "New status", options: statuses },
    source: { label: "New source", options: sources },
    assign: { label: "Assign to", options: [{ value: "none", label: "— Unassigned —" }, ...staff] },
    tag: { label: "Tag", options: tags },
  };
  const target = targets[op];

  return (
    <form
      id={BULK_FORM}
      action={bulkLeads}
      onSubmit={(e) => {
        if (op === "delete" && !window.confirm(`Delete ${count} lead${count === 1 ? "" : "s"}? This can't be undone.`)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm"
    >
      <span className="mr-1 text-xs font-medium text-slate-500" aria-live="polite">{count ? `${count} selected` : "Tick leads to act on several at once"}</span>
      <select name="op" aria-label="Bulk action" value={op} onChange={(e) => setOp(e.target.value)} disabled={!count} className="field h-8 w-auto py-0 text-xs">
        <option value="">Bulk action…</option>
        <option value="status">Change status</option>
        <option value="source">Change source</option>
        <option value="assign">Assign to staff</option>
        {tags.length > 0 && <option value="tag">Add tag</option>}
        <option value="contacted">Mark contacted today</option>
        <option value="lost">Mark as lost</option>
        <option value="unlost">Unmark lost</option>
        <option value="junk">Mark as junk</option>
        <option value="unjunk">Unmark junk</option>
        {canDelete && <option value="delete">Delete</option>}
      </select>
      {target && (
        <select key={op} name="target" aria-label={target.label} required className="field h-8 w-auto py-0 text-xs">
          <option value="">{target.label}…</option>
          {target.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <SubmitButton size="sm" variant={op === "delete" ? "danger" : "primary"} disabled={!count || !op} pendingText="Applying…">Apply</SubmitButton>
    </form>
  );
}
