import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature, Mail, Magnet, Phone, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { deleteEstimateRequest, requestToProposal, updateEstimateRequest } from "../actions";
import { REQ_STATUS } from "../status";

export const metadata: Metadata = { title: "Estimate request" };

export default async function EstimateRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const [{ data: r }, { data: staff }] = await Promise.all([
    supabase.from("estimate_requests").select("*, form:web_forms(name), lead:leads(id, name)").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  if (!r) notFound();
  const { data: proposals } = r.lead_id ? await supabase.from("sales_docs").select("id, number, status, total").eq("lead_id", r.lead_id).eq("kind", "proposal") : { data: [] };
  const st = REQ_STATUS[r.status] ?? REQ_STATUS.new!;
  const canEdit = can("sales", "edit");

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/estimate-requests" className="hover:text-brand-600">Estimate requests</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{r.name}{r.company && <span className="text-slate-400">· {r.company}</span>}<Badge className={st.color}>{st.label}</Badge></span>}
        description={`Received ${formatDateTime(r.created_at)} via ${r.form?.name ?? "web form"}`}
        actions={
          <>
            {canEdit && (
              <form action={requestToProposal}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="accent" size="sm" pendingText="Preparing…"><FileSignature className="h-3.5 w-3.5" /> Create proposal</SubmitButton>
              </form>
            )}
            {canEdit && !r.lead_id && (
              <form action={requestToProposal}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="then" value="lead" />
                <SubmitButton variant="secondary" size="sm" pendingText="Converting…"><Magnet className="h-3.5 w-3.5" /> Convert to lead</SubmitButton>
              </form>
            )}
            {can("sales", "full") && (
              <ConfirmForm action={deleteEstimateRequest} message="Delete this request?">
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete request"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="Request" />
          <CardBody className="space-y-4 text-sm">
            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{r.message || <span className="text-slate-400">No message.</span>}</p>
            {r.budget && <p><span className="label inline">Budget</span> <b>{r.budget}</b></p>}
            {r.lead && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
                Lead created: <Link href={`/leads/${r.lead.id}`} className="font-semibold underline">{r.lead.name}</Link>
                {(proposals?.length ?? 0) > 0 && <> · {proposals!.length} proposal{proposals!.length === 1 ? "" : "s"} — <Link href={`/sales/proposals/${proposals![0]!.id}`} className="font-semibold underline">open latest</Link></>}
              </p>
            )}
          </CardBody>
        </Card>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-2 text-sm">
              <div className="font-semibold text-slate-900">{r.name}</div>
              {r.company && <div className="text-slate-600">{r.company}</div>}
              {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700"><Mail className="h-3.5 w-3.5" />{r.email}</a>}
              {r.phone && <a href={`tel:${r.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700"><Phone className="h-3.5 w-3.5" />{r.phone}</a>}
            </CardBody>
          </Card>
          {canEdit && (
            <Card>
              <CardHeader title="Status" />
              <CardBody>
                <form action={updateEstimateRequest} className="space-y-3">
                  <input type="hidden" name="id" value={id} />
                  <select name="status" defaultValue={r.status} className="field" aria-label="Status">
                    {Object.entries(REQ_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <select name="assigned_to" defaultValue={r.assigned_to ?? ""} className="field" aria-label="Assigned to">
                    <option value="">Unassigned</option>
                    {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <SubmitButton size="sm" variant="secondary" className="w-full" pendingText="Saving…">Save</SubmitButton>
                </form>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
