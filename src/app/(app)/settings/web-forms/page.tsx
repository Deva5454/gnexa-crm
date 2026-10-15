import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";
import { deleteWebForm, saveWebForm } from "./actions";
import { CopyBox } from "./copy-box";

export const metadata: Metadata = { title: "Web forms" };

const FIELDS = [
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "budget", label: "Budget" },
  { key: "message", label: "Message" },
];

type Opts = { sources: { id: number; name: string }[]; statuses: { id: number; name: string }[]; staff: { id: string; full_name: string }[] };

function FormFields({ f, o }: { f?: Tables<"web_forms">; o: Opts }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input name="name" defaultValue={f?.name} required placeholder="Form name, e.g. Website contact form" className="field sm:col-span-2" />
      <textarea name="intro" defaultValue={f?.intro ?? ""} rows={2} placeholder="Intro text shown above the form" className="field sm:col-span-2" />
      <div className="sm:col-span-2">
        <div className="label">Fields (name is always included)</div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
          {FIELDS.map((x) => (
            <span key={x.key} className="flex items-center gap-2">
              <label className="flex items-center gap-1.5"><input type="checkbox" name={`f_${x.key}`} defaultChecked={f ? f.fields.includes(x.key) : x.key !== "budget"} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> {x.label}</label>
              <label className="flex items-center gap-1 text-xs text-slate-400"><input type="checkbox" name={`r_${x.key}`} defaultChecked={f ? f.required.includes(x.key) : x.key === "email"} className="h-3.5 w-3.5 rounded border-slate-300" /> required</label>
            </span>
          ))}
        </div>
      </div>
      <select name="source_id" defaultValue={f?.source_id ?? ""} className="field" aria-label="Lead source">
        <option value="">Lead source: none</option>
        {o.sources.map((s) => <option key={s.id} value={s.id}>Source: {s.name}</option>)}
      </select>
      <select name="status_id" defaultValue={f?.status_id ?? ""} className="field" aria-label="Starting stage">
        <option value="">Stage: first stage</option>
        {o.statuses.map((s) => <option key={s.id} value={s.id}>Stage: {s.name}</option>)}
      </select>
      <select name="assigned_to" defaultValue={f?.assigned_to ?? ""} className="field" aria-label="Assign to">
        <option value="">Assign to: nobody (admins get alerted)</option>
        {o.staff.map((s) => <option key={s.id} value={s.id}>Assign to: {s.full_name}</option>)}
      </select>
      <input name="success_message" defaultValue={f?.success_message} placeholder="Thank-you message" className="field" />
    </div>
  );
}

export default async function WebFormsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: forms }, { data: sources }, { data: statuses }, { data: staff }] = await Promise.all([
    supabase.from("web_forms").select("*").order("created_at"),
    supabase.from("lead_sources").select("id, name").order("name"),
    supabase.from("lead_statuses").select("id, name").order("sort_order"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const o: Opts = { sources: sources ?? [], statuses: statuses ?? [], staff: staff ?? [] };
  return (
    <>
      <Card>
        <CardHeader title="Web forms" description="Put a form on your website: submissions become leads (web-to-lead) or estimate requests, and the assignee gets a notification. Share the link or paste the embed code into your site." />
      </Card>
      {(forms ?? []).map((f) => (
        <Card key={f.id}>
          <CardHeader
            title={<span className="flex items-center gap-2">{f.name}<Badge className={f.kind === "lead" ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-accent-500/10 text-accent-600 ring-accent-500/20"}>{f.kind === "lead" ? "Web-to-lead" : "Estimate request"}</Badge>{!f.is_active && <Badge>Off</Badge>}</span>}
            description={`${f.submissions} submission${f.submissions === 1 ? "" : "s"}`}
          />
          <CardBody className="space-y-4">
            <CopyBox path={`/f/${f.key}`} />
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-brand-600">Edit form</summary>
              <form action={saveWebForm} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={f.id} />
                <FormFields f={f} o={o} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="is_active" defaultChecked={f.is_active} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Accepting submissions</label>
                  <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
                </div>
              </form>
              <ConfirmForm action={deleteWebForm} message={`Delete “${f.name}”? Its link stops working.`} className="mt-2">
                <input type="hidden" name="id" value={f.id} />
                <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete form</button>
              </ConfirmForm>
            </details>
          </CardBody>
        </Card>
      ))}
      <Card>
        <CardHeader title="New form" />
        <CardBody>
          <form action={saveWebForm} className="space-y-3">
            <select name="kind" className="field max-w-xs" aria-label="Form type">
              <option value="lead">Web-to-lead (creates a lead)</option>
              <option value="estimate_request">Estimate request (creates a quote request)</option>
            </select>
            <FormFields o={o} />
            <SubmitButton size="sm" pendingText="Creating…"><Plus className="h-4 w-4" /> Create form</SubmitButton>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
