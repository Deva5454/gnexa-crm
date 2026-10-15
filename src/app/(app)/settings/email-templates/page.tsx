import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveEmailTemplate } from "../actions";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "E-mail templates" };

const VARS: Record<string, string[]> = {
  invoice_send: ["doc_number", "total", "due_date"],
  estimate_send: ["doc_number", "total", "subject"],
  proposal_send: ["doc_number", "total", "subject"],
  credit_note_send: ["doc_number", "total"],
  overdue_reminder: ["doc_number", "due_date", "balance"],
  payment_receipt: ["doc_number", "amount", "reference"],
  subscription_invoice: ["doc_number", "plan", "total"],
  subscription_charged: ["doc_number", "plan", "total"],
  statement: ["from", "to", "balance"],
};

export default async function EmailTemplatesPage() {
  const { supabase } = await requireAdmin();
  const { data: templates } = await supabase.from("email_templates").select("*").order("name");
  return (
    <>
      <Card>
        <CardHeader
          title="E-mail templates"
          description="Used for every e-mail Gnexa sends — by staff and automatically. Placeholders in {braces} are filled in for each message. Every template also has {contact_name}, {customer} and {company_name}."
        />
      </Card>
      {(templates ?? []).map((t) => (
        <Card key={t.key}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <span>
                <span className="block text-sm font-semibold text-slate-900">{t.name}</span>
                <span className="block text-xs text-slate-500">{t.description}</span>
              </span>
              <span className="text-xs font-semibold text-brand-600 group-open:hidden">Edit</span>
            </summary>
            <form action={saveEmailTemplate} className="space-y-3 border-t border-slate-100 p-5">
              <input type="hidden" name="key" value={t.key} />
              <input name="subject" defaultValue={t.subject} required className="field" aria-label="Subject" />
              <textarea name="body" defaultValue={t.body} required rows={8} className="field resize-y font-mono text-[13px]" aria-label="Message" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {[...(VARS[t.key] ?? []), "contact_name", "customer", "company_name"].map((v) => (
                    <code key={v} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{`{${v}}`}</code>
                  ))}
                </div>
                <SubmitButton size="sm" pendingText="Saving…">Save template</SubmitButton>
              </div>
            </form>
          </details>
        </Card>
      ))}
    </>
  );
}
