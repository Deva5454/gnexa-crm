import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { deleteContractTemplate, saveContractExpiry, saveContractTemplate } from "../actions";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Contract settings" };

export default async function ContractSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: types }, { data: templates }, { data: cs }] = await Promise.all([
    supabase.from("contract_types").select("id, name").order("name"),
    supabase.from("contract_templates").select("id, name, content").order("name"),
    supabase.from("company_settings").select("contract_expiry_days").maybeSingle(),
  ]);
  return (
    <>
      <NamedList table="contract_types" title="Contract types" description="AMC, licence, NDA, SOW…" items={types ?? []} />
      <Card>
        <CardHeader title="Expiry reminders" description="Before a signed contract ends: an e-mail to the customer (logged in the e-mail log in the demo) and a bell notification for whoever created it. Checked each morning at 9:10." />
        <CardBody>
          <form action={saveContractExpiry} className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="auto" defaultChecked={cs?.contract_expiry_days != null} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Remind
            </label>
            <input name="days" type="number" min={1} max={90} defaultValue={cs?.contract_expiry_days ?? 7} className="field w-20" aria-label="Days before the end date" />
            <span>days before the end date</span>
            <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Contract templates" description="Ready-made terms to start a contract from (New contract → “Start from a template”)." />
        <ul className="divide-y divide-slate-100">
          {(templates ?? []).map((t) => (
            <li key={t.id} className="p-5">
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">{t.name}</summary>
                <form action={saveContractTemplate} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={t.id} />
                  <Field label="Name"><input name="name" defaultValue={t.name} required maxLength={120} className="field" /></Field>
                  <Field label="Terms"><textarea name="content" defaultValue={t.content} required rows={10} className="field font-mono text-xs" /></Field>
                  <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save</SubmitButton>
                </form>
                <ConfirmForm action={deleteContractTemplate} message={`Delete the template “${t.name}”?`} className="mt-2">
                  <input type="hidden" name="id" value={t.id} />
                  <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </ConfirmForm>
              </details>
            </li>
          ))}
          {!templates?.length && <li className="px-5 py-6 text-sm text-slate-400">No templates yet.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="New template" />
        <CardBody>
          <form action={saveContractTemplate} className="space-y-3">
            <Field label="Name"><input name="name" required maxLength={120} placeholder="e.g. Software licence" className="field" /></Field>
            <Field label="Terms"><textarea name="content" required rows={8} placeholder={"1. Scope\n…"} className="field font-mono text-xs" /></Field>
            <SubmitButton size="sm" pendingText="Adding…">Add template</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
