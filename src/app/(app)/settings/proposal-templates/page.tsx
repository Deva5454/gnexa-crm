import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PROPOSAL_FIELDS } from "@/components/sales/rich-text";
import { requireAdmin } from "@/lib/auth";
import { deleteProposalTemplate, saveProposalTemplate } from "../actions";

export const metadata: Metadata = { title: "Proposal templates" };

const HELP = "Formatting: # Heading · ## Smaller heading · **bold** · *italic* · lines starting with “- ” or “1. ” become lists.";

export default async function ProposalTemplatesPage() {
  const { supabase } = await requireAdmin();
  const { data: templates } = await supabase.from("proposal_templates").select("*").order("name");
  const fields = PROPOSAL_FIELDS.map((f) => `{${f}}`).join(" ");
  return (
    <>
      <Card>
        <CardHeader title="Proposal templates" description={`Ready-made proposal content to insert when writing a proposal. ${HELP} Merge fields: ${fields}`} />
        <ul className="divide-y divide-slate-100">
          {(templates ?? []).map((t) => (
            <li key={t.id} className="p-5">
              <form action={saveProposalTemplate} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <Field label="Name"><input name="name" defaultValue={t.name} required maxLength={120} className="field" /></Field>
                <Field label="Content"><textarea name="content" defaultValue={t.content} required rows={8} className="field font-mono text-xs" /></Field>
                <div className="flex items-center gap-2">
                  <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save</SubmitButton>
                </div>
              </form>
              <ConfirmForm action={deleteProposalTemplate} message={`Delete the template “${t.name}”?`} className="mt-2">
                <input type="hidden" name="id" value={t.id} />
                <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </ConfirmForm>
            </li>
          ))}
          {!templates?.length && <li className="px-5 py-6 text-sm text-slate-400">No templates yet.</li>}
        </ul>
      </Card>
      <Card>
        <CardHeader title="New template" />
        <CardBody>
          <form action={saveProposalTemplate} className="space-y-3">
            <Field label="Name"><input name="name" required maxLength={120} placeholder="e.g. Website project" className="field" /></Field>
            <Field label="Content" hint={HELP}><textarea name="content" required rows={8} placeholder={"## About {customer_name}\n\n- What we'll do\n- Timeline"} className="field font-mono text-xs" /></Field>
            <SubmitButton size="sm" pendingText="Adding…">Add template</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
