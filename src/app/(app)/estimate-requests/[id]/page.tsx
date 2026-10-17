import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature, FileText, Mail, Magnet, Phone, Trash2 } from "lucide-react";
import { EmailHistory } from "@/components/crm/email-history";
import { SendEmailForm } from "@/components/crm/send-email-form";
import { ColorBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireFeature, requireStaff } from "@/lib/auth";
import { renderTemplate } from "@/lib/email-templates";
import { docHref, docNumber } from "@/lib/sales";
import { companySettings } from "@/lib/sales-data";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { deleteEstimateRequest, requestToEstimate, requestToProposal, sendRequestEmail, updateEstimateRequest } from "../actions";
import { reqStatuses } from "../status";

export const metadata: Metadata = { title: "Estimate request" };

export default async function EstimateRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("estimate_requests"); // Setup → Modules
  const id = Number((await params).id);
  const { supabase, can, profile } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const [{ data: r }, { data: staff }] = await Promise.all([
    supabase.from("estimate_requests").select("*, form:web_forms(name), lead:leads(id, name), customer:customers(id, company)").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  if (!r) notFound();
  const [{ data: proposals }, { data: estimates }, company] = await Promise.all([
    r.lead_id ? supabase.from("sales_docs").select("id, number, status, total").eq("lead_id", r.lead_id).eq("kind", "proposal") : Promise.resolve({ data: [] as { id: number; number: number; status: string; total: number }[] }),
    r.customer_id
      ? supabase.from("sales_docs").select("id, number, total, currency").eq("customer_id", r.customer_id).eq("kind", "estimate").gte("created_at", r.created_at).order("id", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as { id: number; number: number; total: number; currency: string }[] }),
    companySettings(supabase),
  ]);
  const reply = await renderTemplate(supabase, "estimate_request_reply", {
    name: r.name.split(" ")[0] || r.name,
    company_name: company?.company_name ?? "",
    staff_name: profile.full_name ?? "",
  });
  const statuses = await reqStatuses(supabase);
  const st = statuses.of(r.status);
  const canEdit = can("sales", "edit");

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/estimate-requests" className="hover:text-brand-600">Estimate requests</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{r.name}{r.company && <span className="text-slate-400">· {r.company}</span>}<ColorBadge color={st.color}>{st.name}</ColorBadge></span>}
        description={`Received ${formatDateTime(r.created_at)} via ${r.form?.name ?? "web form"}`}
        actions={
          <>
            {canEdit && (
              <form action={requestToProposal}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="accent" size="sm" pendingText="Preparing…"><FileSignature className="h-3.5 w-3.5" /> Create proposal</SubmitButton>
              </form>
            )}
            {canEdit && (
              <form action={requestToEstimate}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="secondary" size="sm" pendingText="Preparing…"><FileText className="h-3.5 w-3.5" /> Create estimate</SubmitButton>
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Request" />
            <CardBody className="space-y-4 text-sm">
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{r.message || <span className="text-slate-400">No message.</span>}</p>
              {r.budget && <p><span className="label inline">Budget</span> <b>{r.budget}</b></p>}
              {r.customer && (
                <p className="rounded-xl bg-sky-50 px-4 py-3 text-sky-800">
                  Customer: <Link href={`/customers/${r.customer.id}`} className="font-semibold underline">{r.customer.company}</Link>
                  {(estimates?.length ?? 0) > 0 && (
                    <>
                      {" "}· estimates since this request:{" "}
                      {estimates!.map((e, i) => (
                        <span key={e.id}>{i > 0 && ", "}<Link href={docHref("estimate", e.id)} className="font-mono font-semibold underline">{docNumber("estimate", e.number)}</Link> ({formatMoney(Number(e.total), e.currency)})</span>
                      ))}
                    </>
                  )}
                </p>
              )}
              {r.lead && (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
                  Lead created: <Link href={`/leads/${r.lead.id}`} className="font-semibold underline">{r.lead.name}</Link>
                  {(proposals?.length ?? 0) > 0 && <> · {proposals!.length} proposal{proposals!.length === 1 ? "" : "s"} — <Link href={`/sales/proposals/${proposals![0]!.id}`} className="font-semibold underline">open latest</Link></>}
                </p>
              )}
            </CardBody>
          </Card>
          <EmailHistory relType="estimate_request" relId={id} />
        </div>
        <aside className="space-y-6">
          {canEdit && r.email && (
            <Card>
              <CardHeader title="Reply" description="E-mail the person who asked for the quote" />
              <CardBody>
                <SendEmailForm
                  action={sendRequestEmail}
                  hidden={{ request_id: id }}
                  recipients={[{ email: r.email, name: r.name }]}
                  subject={reply?.subject ?? "Re: your quote request"}
                  body={reply?.body ?? ""}
                  label="E-mail requester"
                />
              </CardBody>
            </Card>
          )}
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
                    {statuses.list.map((v) => <option key={v.key} value={v.key}>{v.name}</option>)}
                  </select>
                  <select name="assigned_to" defaultValue={r.assigned_to ?? ""} className="field" aria-label="Assigned to">
                    <option value="">Unassigned</option>
                    {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  {r.email && (
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" name="notify" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                      E-mail {r.name.split(" ")[0]} if the status changes
                    </label>
                  )}
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
