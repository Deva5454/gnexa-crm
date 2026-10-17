import type { Metadata } from "next";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { RelatedTasks } from "@/components/crm/related-tasks";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Copy, Paperclip, Pencil, Printer, RotateCcw, Send, Trash2 } from "lucide-react";
import { EmailHistory } from "@/components/crm/email-history";
import { FileUploader } from "@/components/crm/file-uploader";
import { NotesPanel } from "@/components/crm/notes-panel";
import { SendEmailForm, type Recipient } from "@/components/crm/send-email-form";
import { renderTemplate } from "@/lib/email-templates";
import { addDays } from "@/lib/sales";
import { ContractPaper } from "@/components/sales/contract-paper";
import { loadParty } from "@/components/sales/party";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { contractNumber, contractState } from "@/lib/constants";
import { companySettings } from "@/lib/sales-data";
import { cn, formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { copyContract, deleteContract, deleteContractComment, deleteContractFile, recordContractFile, sendContractEmail, setContractStatus } from "../actions";
import { ContractCommentForm, RenewForm } from "./panels";
import { SignForm } from "./sign-form";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "Contract" };

function StatusBtn({ id, status, label, icon: Icon }: { id: number; status: string; label: string; icon: typeof Send }) {
  return (
    <form action={setContractStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={status === "sent" ? "primary" : "secondary"} size="sm"><Icon className="h-3.5 w-3.5" /> {label}</SubmitButton>
    </form>
  );
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can, profile } = await requireStaff();
  if (!can("contracts", "view")) notFound();
  const [{ data: c }, company, { data: renewals }, { data: comments }, { data: files }] = await Promise.all([
    supabase.from("contracts").select("*, type:contract_types(name), project:projects(id, name)").eq("id", id).maybeSingle(),
    companySettings(supabase),
    supabase.from("contract_renewals").select("id, old_start, old_end, old_value, new_start, new_end, new_value, created_at, renewer:profiles(full_name)").eq("contract_id", id).order("created_at", { ascending: false }),
    supabase.from("contract_comments").select("id, body, from_customer, author_name, staff_id, created_at, staff:profiles(full_name)").eq("contract_id", id).order("created_at"),
    supabase.from("contract_files").select("id, name, size, uploaded_by, created_at, uploader:profiles(full_name)").eq("contract_id", id).order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();
  const { data: contactRows } = await supabase.from("contacts").select("email, first_name, last_name").eq("customer_id", c.customer_id).not("email", "is", null).order("is_primary", { ascending: false });
  const recipients: Recipient[] = (contactRows ?? []).map((x) => ({ email: x.email!, name: [x.first_name, x.last_name].filter(Boolean).join(" ") || null }));
  const { type, project, ...contract } = c;
  const party = await loadParty(supabase, { customer_id: c.customer_id, lead_id: null });
  const st = contractState(c);
  const canEdit = can("contracts", "edit");
  const today = todayIST();
  const daysLeft = c.end_date ? Math.round((new Date(c.end_date).getTime() - new Date(today).getTime()) / 86400_000) : null;
  const canFull = can("contracts", "full");
  const tplVars = {
    contact_name: (recipients[0]?.name ?? "").split(" ")[0] || "there",
    customer: party.name,
    company_name: company?.company_name ?? "",
    contract_number: contractNumber(id),
    subject: c.subject,
    start_date: formatDate(c.start_date),
    end_date: c.end_date ? formatDate(c.end_date) : "further notice",
    value: c.value != null ? formatMoney(Number(c.value)) : "—",
  };
  const ending = c.status === "signed" && daysLeft != null && daysLeft <= 30;
  const [sendTpl, expiryTpl] = await Promise.all([renderTemplate(supabase, "contract_send", tplVars), ending ? renderTemplate(supabase, "contract_expiry", tplVars) : Promise.resolve(null)]);
  // A renewal continues from the day after the current end, for the same length
  const renewStart = c.end_date ? addDays(c.end_date, 1) : today;
  const termDays = c.end_date ? Math.round((Date.parse(c.end_date) - Date.parse(c.start_date)) / 86400_000) : 364;
  const renewEnd = addDays(renewStart, termDays);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/contracts" className="hover:text-brand-600">Contracts</Link>}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono">{contractNumber(id)}</span><Badge className={st.color}>{st.label}</Badge></span>}
        description={party.href ? <Link href={party.href} className="hover:text-brand-600">{party.name} · {c.subject}</Link> : c.subject}
        actions={
          <>
            <a href={`/print/contracts/${id}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}><Printer className="h-3.5 w-3.5" /> PDF / Print</a>
            {canEdit && c.status !== "cancelled" && <LinkButton href={`/contracts/${id}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
            {canEdit && c.status === "draft" && <StatusBtn id={id} status="sent" label="Send for signature" icon={Send} />}
            {canEdit && (
              <form action={copyContract}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="secondary" size="sm" pendingText="Copying…"><Copy className="h-3.5 w-3.5" /> Copy</SubmitButton>
              </form>
            )}
            {canEdit && c.status !== "cancelled" && c.status !== "draft" && <StatusBtn id={id} status="cancelled" label="Cancel" icon={Ban} />}
            {canEdit && (c.status === "cancelled" || c.status === "sent") && <StatusBtn id={id} status="draft" label="Back to draft" icon={RotateCcw} />}
            {can("contracts", "full") && (
              <ConfirmForm action={deleteContract} message={`Delete contract ${contractNumber(id)}?`}>
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete contract"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <ContractPaper contract={contract} typeName={type?.name ?? null} company={company} party={party} />
          <Card>
            <CardHeader title="Discussion" description={c.visible_to_client && c.status !== "draft" ? "With the customer — they see and reply to this in the client portal." : "The customer sees this once the contract is sent and visible in their portal."} />
            <CardBody className="space-y-4">
              {(comments ?? []).length > 0 ? (
                <ul className="space-y-3">
                  {(comments ?? []).map((m) => (
                    <li key={m.id} className={cn("group rounded-xl px-3 py-2 text-sm", m.from_customer ? "bg-slate-50" : "bg-brand-50")}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800">{m.from_customer ? `${m.author_name ?? "Customer"} · customer` : (m.staff?.full_name ?? "Staff")}</span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <span suppressHydrationWarning>{formatDateTime(m.created_at)}</span>
                          {canEdit && !m.from_customer && (m.staff_id === profile.id || canFull) && (
                            <ConfirmForm action={deleteContractComment} message="Delete this comment?">
                              <input type="hidden" name="id" value={m.id} />
                              <button className="rounded p-0.5 text-slate-300 hover:text-rose-600" aria-label="Delete comment"><Trash2 className="h-3 w-3" /></button>
                            </ConfirmForm>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No comments yet.</p>
              )}
              {canEdit && <ContractCommentForm id={id} />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Attachments" description="Staff only — e.g. the scanned signed copy" />
            <CardBody className="space-y-3">
              {(files ?? []).length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-sm">
                  {(files ?? []).map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                      <a href={`/contracts/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-700 hover:text-brand-700">{f.name}</a>
                      <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{f.uploader?.full_name ?? ""} · {formatDate(f.created_at)}</span>
                      {canEdit && (f.uploaded_by === profile.id || canFull) && (
                        <ConfirmForm action={deleteContractFile} message={`Delete ${f.name}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="rounded p-0.5 text-slate-300 hover:text-rose-600" aria-label={`Delete ${f.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? <FileUploader bucket="contract-files" relId={id} record={recordContractFile} /> : !(files ?? []).length && <p className="text-sm text-slate-400">No files.</p>}
            </CardBody>
          </Card>
          <NotesPanel relType="contract" relId={id} path={`/contracts/${id}`} />
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span>{type?.name ?? "—"}</span></div>
              {project && <div className="flex justify-between gap-2"><span className="text-slate-500">Project</span><Link href={`/projects/${project.id}`} className="truncate text-brand-700 hover:underline">{project.name}</Link></div>}
              <div className="flex justify-between"><span className="text-slate-500">Portal</span><span className={c.visible_to_client ? "" : "font-medium text-amber-700"}>{c.visible_to_client ? "Visible to customer" : "Hidden from customer"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Value</span><b>{c.value != null ? formatMoney(Number(c.value)) : "—"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Term</span><span>{formatDate(c.start_date)} → {formatDate(c.end_date)}</span></div>
              {daysLeft != null && c.status === "signed" && (
                <div className="flex justify-between"><span className="text-slate-500">{daysLeft >= 0 ? "Ends in" : "Ended"}</span><span className={daysLeft < 30 ? "font-semibold text-amber-600" : ""}>{Math.abs(daysLeft)} days{daysLeft < 0 ? " ago" : ""}</span></div>
              )}
              {c.signed_by && <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-500">Signed by</span><span className="font-medium">{c.signed_by}</span></div>}
              {c.signed_at && <div className="flex justify-between"><span className="text-slate-500">Signed on</span><span>{formatDate(c.signed_at)}</span></div>}
            </CardBody>
          </Card>
          {canEdit && c.status === "sent" && (
            <Card>
              <CardHeader title="Record signature" description="Once you have the signed copy back." />
              <CardBody><SignForm id={id} defaultSigner={party.contact ?? ""} /></CardBody>
            </Card>
          )}
          {canEdit && c.status !== "cancelled" && c.status !== "draft" && (
            <Card>
              <CardHeader title="Renew" description={st.key === "expiring" || st.key === "expired" ? "This contract is ending — extend it with new dates and value." : "Extend with new dates and value; the current term goes into the history."} />
              <CardBody><RenewForm id={id} start={renewStart} end={renewEnd} value={c.value != null ? Number(c.value) : null} signed={c.status === "signed"} /></CardBody>
            </Card>
          )}
          {(renewals ?? []).length > 0 && (
            <Card>
              <CardHeader title="Renewal history" />
              <ul className="divide-y divide-slate-100 text-xs">
                {(renewals ?? []).map((r) => (
                  <li key={r.id} className="px-5 py-2.5">
                    <div className="text-slate-500">{formatDate(r.old_start)} → {formatDate(r.old_end)} · {r.old_value != null ? formatMoney(Number(r.old_value)) : "—"}</div>
                    <div className="font-medium text-slate-800">→ {formatDate(r.new_start)} → {formatDate(r.new_end)} · {r.new_value != null ? formatMoney(Number(r.new_value)) : "—"}</div>
                    <div className="text-slate-400">{r.renewer?.full_name ?? "—"} · {formatDate(r.created_at)}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {canEdit && (
            <Card>
              <CardHeader title="E-mail" description={c.visible_to_client ? undefined : "Hidden from the customer's portal — they can't sign it online."} />
              <CardBody className="space-y-2">
                <SendEmailForm
                  action={sendContractEmail}
                  hidden={{ contract_id: id, kind: "document" }}
                  recipients={recipients}
                  subject={sendTpl?.subject ?? `Contract ${contractNumber(id)}`}
                  body={sendTpl?.body ?? ""}
                  attachment={`${contractNumber(id)}.pdf`}
                  label={c.status === "draft" ? "E-mail for signature" : "E-mail contract"}
                  tone={c.status === "draft" ? "primary" : "secondary"}
                />
                {expiryTpl && (
                  <SendEmailForm
                    action={sendContractEmail}
                    hidden={{ contract_id: id, kind: "contract_expiry" }}
                    recipients={recipients}
                    subject={expiryTpl.subject}
                    body={expiryTpl.body}
                    label={c.expiry_reminded_at ? `Expiry reminder sent ${formatDate(c.expiry_reminded_at)} — send again` : "Send expiry reminder"}
                    buttonLabel="Send reminder"
                    icon="bell"
                  />
                )}
              </CardBody>
            </Card>
          )}
          <EmailHistory relType="contract" relId={id} />
          <CustomFieldsCard entity="contract" relId={id} path={`/contracts/${id}`} />
          <RemindersPanel relType="contract" relId={id} path={`/contracts/${id}`} />
          <RelatedTasks relType="contract" relId={id} compact />
        </aside>
      </div>
    </>
  );
}
