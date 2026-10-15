import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireAdmin } from "@/lib/auth";
import { addTax, deleteNamed } from "../actions";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Finance settings" };

export default async function FinanceSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: taxes }, { data: modes }, { data: cats }] = await Promise.all([
    supabase.from("taxes").select("id, name, rate").order("rate"),
    supabase.from("payment_modes").select("id, name").order("id"),
    supabase.from("expense_categories").select("id, name").order("name"),
  ]);
  return (
    <>
      <Card>
        <CardHeader title="Tax rates" description="Offered on line items and expenses. Invoices split GST into CGST + SGST." />
        <ul className="divide-y divide-slate-100">
          {taxes?.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="flex-1 font-medium text-slate-700">{t.name}</span>
              <span className="font-mono text-slate-500">{Number(t.rate)}%</span>
              <ConfirmForm action={deleteNamed} message={`Delete ${t.name}? Existing documents keep their rates.`}>
                <input type="hidden" name="table" value="taxes" />
                <input type="hidden" name="id" value={t.id} />
                <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${t.name}`}><Trash2 className="h-4 w-4" /></button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
        <form action={addTax} className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
          <input name="name" placeholder="Name, e.g. GST 18%" className="field max-w-[220px]" />
          <input name="rate" type="number" min="0" max="100" step="0.01" required placeholder="Rate %" className="field w-28" />
          <Button variant="secondary"><Plus className="h-4 w-4" /> Add</Button>
        </form>
      </Card>
      <NamedList table="payment_modes" title="Payment modes" description="How customers pay you." items={modes ?? []} />
      <NamedList table="expense_categories" title="Expense categories" items={cats ?? []} />
    </>
  );
}
