import { Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addNamed, deleteNamed, savePaymentMode } from "../actions";

type Mode = { id: number; name: string; description: string | null; is_active: boolean; show_on_invoice: boolean; is_default: boolean; applies_to: string };

const APPLIES = [
  { value: "all", label: "Invoices & expenses" },
  { value: "invoices", label: "Invoices only" },
  { value: "expenses", label: "Expenses only" },
];

/** Payment modes with Perfex's options: description, show on invoice, selected by default, invoices / expenses only, active. */
export function PaymentModes({ modes }: { modes: Mode[] }) {
  const check = "h-4 w-4 rounded border-slate-300 text-brand-600";
  return (
    <Card>
      <CardHeader
        title="Payment modes"
        description="How customers pay you. Modes marked “Show on invoice” print their description (bank or UPI details) under “Ways to pay” on invoices and in the client portal."
      />
      <ul className="divide-y divide-slate-100">
        {modes.map((m) => (
          <li key={m.id} className="px-5 py-4">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-slate-800">{m.name}</span>
                {m.is_default && <Badge className="bg-brand-50 text-brand-700 ring-brand-200"><Star className="mr-0.5 inline h-3 w-3" aria-hidden />Default</Badge>}
                {!m.is_active && <Badge className="bg-slate-100 text-slate-500 ring-slate-200">Inactive</Badge>}
                {m.show_on_invoice && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">On invoices</Badge>}
                {m.applies_to !== "all" && <Badge className="bg-sky-50 text-sky-700 ring-sky-200">{APPLIES.find((a) => a.value === m.applies_to)?.label}</Badge>}
                <span className="ml-auto text-xs font-medium text-brand-600 group-open:hidden">Edit</span>
              </summary>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <form action={savePaymentMode} className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={m.id} />
                  <label className="text-xs font-medium text-slate-600">
                    Name
                    <input name="name" defaultValue={m.name} required maxLength={80} className="field mt-1" />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Use for
                    <select name="applies_to" defaultValue={m.applies_to} className="field mt-1">
                      {APPLIES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                    Description <span className="font-normal text-slate-400">— e.g. account name, number and IFSC, or a UPI ID</span>
                    <textarea name="description" defaultValue={m.description ?? ""} rows={3} maxLength={1000} className="field mt-1" />
                  </label>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 sm:col-span-2">
                    <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={m.is_active} className={check} /> Active</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="show_on_invoice" defaultChecked={m.show_on_invoice} className={check} /> Show on invoice</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="is_default" defaultChecked={m.is_default} className={check} /> Selected by default</label>
                    <SubmitButton size="sm" variant="secondary" pendingText="Saving…" className="ml-auto">Save</SubmitButton>
                  </div>
                </form>
                <ConfirmForm action={deleteNamed} message={`Delete “${m.name}”? Payments and expenses that used it keep their amounts but lose the mode.`}>
                  <input type="hidden" name="table" value="payment_modes" />
                  <input type="hidden" name="id" value={m.id} />
                  <button className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${m.name}`}><Trash2 className="h-4 w-4" /></button>
                </ConfirmForm>
              </div>
            </details>
          </li>
        ))}
        {!modes.length && <li className="px-5 py-4 text-sm text-slate-400">Nothing yet.</li>}
      </ul>
      <form action={addNamed} className="flex gap-2 border-t border-slate-100 p-4">
        <input type="hidden" name="table" value="payment_modes" />
        <input name="name" required placeholder="Add a payment mode…" aria-label="New payment mode" className="field" />
        <Button variant="secondary"><Plus className="h-4 w-4" /> Add</Button>
      </form>
    </Card>
  );
}
