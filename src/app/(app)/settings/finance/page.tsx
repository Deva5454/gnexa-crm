import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireAdmin } from "@/lib/auth";
import { addTax, deleteNamed, saveExpirySettings, saveReminderSettings } from "../actions";
import { NamedList } from "../named-list";
import { PaymentModes } from "./payment-modes";

export const metadata: Metadata = { title: "Finance settings" };

export default async function FinanceSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: taxes }, { data: modes }, { data: cats }, { data: cs }] = await Promise.all([
    supabase.from("taxes").select("id, name, rate").order("rate"),
    supabase.from("payment_modes").select("id, name, description, is_active, show_on_invoice, is_default, applies_to").order("id"),
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.from("company_settings").select("auto_overdue_reminders, overdue_reminder_days, auto_expiry_reminders, expiry_reminder_days").maybeSingle(),
  ]);
  return (
    <>
      <Card>
        <CardHeader title="Tax rates" description="Offered on line items and expenses. Invoices print CGST + SGST for customers in your state (from your GSTIN) and IGST for other states and exports." />
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
      <Card>
        <CardHeader title="Overdue reminders" description="Automatic e-mails for unpaid invoices past their due date. Demo: logged in the e-mail log, not delivered." />
        <CardBody>
          <form action={saveReminderSettings} className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="auto" defaultChecked={cs?.auto_overdue_reminders ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Send automatically, then again every
            </label>
            <input name="days" type="number" min={1} max={60} defaultValue={cs?.overdue_reminder_days ?? 7} className="field w-20" aria-label="Days between reminders" />
            <span>days until paid</span>
            <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Estimate & proposal expiry reminders" description="One automatic e-mail to the customer shortly before a sent estimate or proposal expires (each morning, 9:00). Demo: logged in the e-mail log, not delivered." />
        <CardBody>
          <form action={saveExpirySettings} className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="auto" defaultChecked={cs?.auto_expiry_reminders ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Send automatically
            </label>
            <input name="days" type="number" min={1} max={30} defaultValue={cs?.expiry_reminder_days ?? 3} className="field w-20" aria-label="Days before expiry" />
            <span>days before it expires</span>
            <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
          </form>
        </CardBody>
      </Card>
      <PaymentModes modes={modes ?? []} />
      <NamedList table="expense_categories" title="Expense categories" items={cats ?? []} />
    </>
  );
}
