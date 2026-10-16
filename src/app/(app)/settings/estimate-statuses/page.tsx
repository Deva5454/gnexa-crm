import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { ColorBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { deleteReqStatus, saveReqStatus } from "../actions";

export const metadata: Metadata = { title: "Estimate request statuses" };

export default async function EstimateStatusesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: statuses }, { data: used }] = await Promise.all([
    supabase.from("estimate_request_statuses").select("*").order("sort_order"),
    supabase.from("estimate_requests").select("status"),
  ]);
  const count = (k: string) => (used ?? []).filter((u) => u.status === k).length;
  return (
    <Card>
      <CardHeader title="Estimate request statuses" description="The stages a request moves through. “Open” statuses show in the default list." />
      <ul className="divide-y divide-slate-100">
        {(statuses ?? []).map((s) => (
          <li key={s.key} className="px-5 py-3">
            <form action={saveReqStatus} className="flex flex-wrap items-center gap-3 text-sm">
              <input type="hidden" name="key" value={s.key} />
              <ColorBadge color={s.color}>{s.name}</ColorBadge>
              <input name="name" defaultValue={s.name} required maxLength={40} className="field h-9 w-44" aria-label="Status name" />
              <input type="color" name="color" defaultValue={s.color} className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label="Colour" />
              <input type="number" name="sort_order" defaultValue={s.sort_order} className="field h-9 w-20" aria-label="Order" />
              <label className="flex items-center gap-1.5 text-slate-600">
                <input type="checkbox" name="is_open" defaultChecked={s.is_open} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Open
              </label>
              <span className="text-xs text-slate-400">{count(s.key)} request{count(s.key) === 1 ? "" : "s"}</span>
              <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
            </form>
            <ConfirmForm action={deleteReqStatus} message={`Delete the “${s.name}” status?`} className="mt-1">
              <input type="hidden" name="key" value={s.key} />
              <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600" aria-label={`Delete ${s.name}`}>
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </ConfirmForm>
          </li>
        ))}
      </ul>
      <form action={saveReqStatus} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4 text-sm">
        <input name="name" required maxLength={40} placeholder="New status, e.g. Site visit" className="field h-9 w-56" aria-label="New status name" />
        <input type="color" name="color" defaultValue="#6366f1" className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label="Colour" />
        <input type="number" name="sort_order" defaultValue={(statuses?.length ?? 0) + 1} className="field h-9 w-20" aria-label="Order" />
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" name="is_open" defaultChecked className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Open
        </label>
        <SubmitButton size="sm" pendingText="Adding…"><Plus className="h-3.5 w-3.5" /> Add status</SubmitButton>
      </form>
    </Card>
  );
}
