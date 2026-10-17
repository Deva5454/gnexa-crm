import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { DATE_FORMATS } from "@/lib/format-config";
import { saveNumbering, saveRecordDefaults } from "./actions";
import { CompanyForm } from "./company-form";
import { ResetDemo } from "./reset-demo";

export const metadata: Metadata = { title: "Setup" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("company_settings").select("*").maybeSingle();
  return (
    <>
      <Card>
        <CardHeader title="Company" description="Printed on proposals, estimates and invoices." />
        <CardBody>
          <CompanyForm settings={data} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Numbering & dates" description="How document numbers and dates appear on every screen, PDF, e-mail and notification. Existing documents keep their numbers — only the prefix shown changes." />
        <CardBody>
          <form action={saveNumbering} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              ["invoice_prefix", "Invoice prefix", data?.invoice_prefix ?? "INV"],
              ["estimate_prefix", "Estimate prefix", data?.estimate_prefix ?? "EST"],
              ["proposal_prefix", "Proposal prefix", data?.proposal_prefix ?? "PRO"],
              ["credit_note_prefix", "Credit note prefix", data?.credit_note_prefix ?? "CN"],
            ] as const).map(([name, label, value]) => (
              <Field key={name} label={label} htmlFor={name}>
                <input id={name} name={name} defaultValue={value} required maxLength={10} pattern="[A-Za-z0-9/]{1,10}" className="field uppercase" />
              </Field>
            ))}
            <Field label="Number digits" htmlFor="number_padding" hint={`e.g. ${data?.invoice_prefix ?? "INV"}-${"12".padStart(data?.number_padding ?? 5, "0")}`}>
              <input id="number_padding" name="number_padding" type="number" min={1} max={10} defaultValue={data?.number_padding ?? 5} className="field" />
            </Field>
            <Field label="Date format" htmlFor="date_format" className="col-span-2">
              <select id="date_format" name="date_format" defaultValue={data?.date_format ?? "dd MMM yyyy"} className="field">
                {DATE_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <div className="flex items-end justify-end">
              <SubmitButton pendingText="Saving…">Save</SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="New records" description="What new invoices, estimates, proposals and customers start with. Each can still be changed on the record." />
        <CardBody>
          <form action={saveRecordDefaults} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Invoice due after (days)" htmlFor="invoice_due_days" hint="0 = due on the invoice date">
              <input id="invoice_due_days" name="invoice_due_days" type="number" min={0} max={365} defaultValue={data?.invoice_due_days ?? 15} className="field" />
            </Field>
            <Field label="Estimates & proposals valid for (days)" htmlFor="quote_valid_days">
              <input id="quote_valid_days" name="quote_valid_days" type="number" min={1} max={365} defaultValue={data?.quote_valid_days ?? 30} className="field" />
            </Field>
            <Field label="Default invoice note (shown to the customer)" htmlFor="invoice_note" className="sm:col-span-2">
              <textarea id="invoice_note" name="invoice_note" rows={2} maxLength={1000} defaultValue={data?.invoice_note ?? ""} className="field" />
            </Field>
            <Field label="Default estimate terms" htmlFor="estimate_terms">
              <textarea id="estimate_terms" name="estimate_terms" rows={3} maxLength={2000} defaultValue={data?.estimate_terms ?? ""} className="field" />
            </Field>
            <Field label="Default proposal terms" htmlFor="proposal_terms">
              <textarea id="proposal_terms" name="proposal_terms" rows={3} maxLength={2000} defaultValue={data?.proposal_terms ?? ""} className="field" />
            </Field>
            <Field label="Default country for new customers" htmlFor="default_country">
              <input id="default_country" name="default_country" maxLength={80} defaultValue={data?.default_country ?? ""} className="field" />
            </Field>
            <div className="flex items-end justify-end">
              <SubmitButton pendingText="Saving…">Save defaults</SubmitButton>
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-400">Default invoice terms are set in Company above.</p>
        </CardBody>
      </Card>
      {data?.demo_mode !== false && (
        <>
          <Card>
            <CardHeader
              title="Demo data"
              description="Restore the sample customers, leads, tasks and notes before a pitch. Staff and pipeline settings are kept; the demo roles' permissions are restored."
            />
            <CardBody>
              <ResetDemo />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Going live" description="This install is running as a public demo. Only the owner can switch that off." />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>1. In Supabase, open <b>Authentication → Users → Add user</b> and create your own account.</p>
              <p>
                2. In the Supabase <b>SQL editor</b>, run <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">select private.go_live(&apos;you@yourcompany.com&apos;);</code> —
                or add <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">, true</code> to also clear the demo data.
              </p>
              <p>3. Sign in at <b>/login</b> with your account. The demo accounts are switched off and the role switcher disappears.</p>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
