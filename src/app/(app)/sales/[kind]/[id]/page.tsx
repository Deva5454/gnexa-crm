import type { Metadata } from "next";
import { renderTemplate } from "@/lib/email-templates";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { pdfFields } from "@/lib/custom-fields";
import { RelatedTasks } from "@/components/crm/related-tasks";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, Ban, Check, Copy, Download, Lock, Paperclip, Pencil, Printer, Repeat, RotateCcw, Send, Trash2, X } from "lucide-react";
import { FileUploader } from "@/components/crm/file-uploader";
import { CopyLink, StaffCommentForm } from "@/components/sales/share-panel";
import { headers } from "next/headers";
import { EmailHistory } from "@/components/crm/email-history";
import { SendEmailForm, type Recipient } from "@/components/crm/send-email-form";
import { sendDocEmail } from "@/lib/actions/email";
import { DocPaper } from "@/components/sales/doc-paper";
import { loadParty } from "@/components/sales/party";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber, docStatus, INTERVAL_LABEL, KINDS, kindFromSlug, type DocKind } from "@/lib/sales";
import { balancesFor, companySettings } from "@/lib/sales-data";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { daysFromToday } from "@/lib/dates";
import { convertDoc, copyDoc, createPublicLink, deleteDoc, deleteDocComment, deleteDocFile, deletePayment, disablePublicLink, recordDocFile, removeCredit, setAllowComments, setDocStatus } from "../../actions";
import { ApplyCreditForm, PaymentForm } from "./panels";

export const metadata: Metadata = { title: "Document" };



function StatusButton({ id, status, label, icon: Icon, variant = "secondary" }: { id: number; status: string; label: string; icon: typeof Send; variant?: "secondary" | "primary" | "accent" }) {
  return (
    <form action={setDocStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} size="sm">
        <Icon className="h-3.5 w-3.5" /> {label}
      </SubmitButton>
    </form>
  );
}

export default async function DocPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const p = await params;
  const kind = kindFromSlug(p.kind);
  const id = Number(p.id);
  if (!kind) notFound();
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();

  const [{ data: doc }, { data: lines }, company, extra] = await Promise.all([
    supabase.from("sales_docs").select("*").eq("id", id).eq("kind", kind).maybeSingle(),
    supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position"),
    companySettings(supabase),
    pdfFields(supabase, id),
  ]);
  if (!doc) notFound();

  const [{ data: agent }, { data: adminNote }, { data: files }] = await Promise.all([
    doc.sale_agent ? supabase.from("profiles").select("full_name").eq("id", doc.sale_agent).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("sales_doc_notes").select("note, updated_at, by:profiles(full_name)").eq("doc_id", id).maybeSingle(),
    supabase.from("sales_doc_files").select("id, name, size, created_at, uploader:profiles!sales_doc_files_uploaded_by_fkey(full_name)").eq("doc_id", id).order("created_at", { ascending: false }),
  ]);
  const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

  const [party, bals, { data: derived }, { data: source }, { data: payments }, { data: credits }, { data: modes }] = await Promise.all([
    loadParty(supabase, doc),
    balancesFor(supabase, [id]),
    supabase.from("sales_docs").select("id, kind, number").eq("source_id", id),
    doc.source_id ? supabase.from("sales_docs").select("id, kind, number").eq("id", doc.source_id).maybeSingle() : Promise.resolve({ data: null }),
    kind === "invoice"
      ? supabase.from("payments").select("id, amount, date, transaction_id, note, mode:payment_modes(name)").eq("invoice_id", id).order("date")
      : Promise.resolve({ data: [] as never[] }),
    kind === "invoice" || kind === "credit_note"
      ? supabase
          .from("credit_applications")
          .select("id, amount, date, credit_note_id, invoice_id")
          .eq(kind === "invoice" ? "invoice_id" : "credit_note_id", id)
          .order("date")
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("payment_modes").select("id, name").eq("is_active", true).order("id"),
  ]);
  const bal = bals.get(id);
  const status = docStatus({ kind, status: doc.status, due_date: doc.due_date, total: Number(doc.total) }, bal);
  const cur = doc.currency;
  const canEdit = can("sales", "edit");
  const canDelete = can("sales", "full");

  // Numbers for the other side of credit applications
  const otherIds = (credits ?? []).map((c) => (kind === "invoice" ? c.credit_note_id : c.invoice_id));
  const { data: others } = otherIds.length ? await supabase.from("sales_docs").select("id, kind, number").in("id", otherIds) : { data: [] };
  const otherLabel = (oid: number) => {
    const o = others?.find((x) => x.id === oid);
    return o ? docNumber(o.kind, o.number) : `#${oid}`;
  };

  // Credit note: open invoices of the same customer
  let openInvoices: { id: number; label: string; balance: number }[] = [];
  if (kind === "credit_note" && doc.customer_id && (bal?.balance ?? 0) > 0 && status.key !== "draft") {
    const { data: invs } = await supabase.from("sales_docs").select("id, number, status").eq("kind", "invoice").eq("customer_id", doc.customer_id).neq("status", "cancelled");
    const ib = await balancesFor(supabase, (invs ?? []).map((i) => i.id));
    openInvoices = (invs ?? [])
      .filter((i) => i.status !== "draft" && (ib.get(i.id)?.balance ?? 0) > 0.005)
      .map((i) => ({ id: i.id, balance: ib.get(i.id)!.balance, label: `${docNumber("invoice", i.number)} · due ${formatMoney(ib.get(i.id)!.balance, cur)}` }));
  }

  // Recurring: the template's copies, or the template this copy came from; subscription it bills
  const [{ data: copies }, { data: template }, { data: sub }, recipients] = await Promise.all([
    doc.recurring_every ? supabase.from("sales_docs").select("id, number, date, total, status").eq("recurring_from", id).order("date", { ascending: false }) : Promise.resolve({ data: null }),
    doc.recurring_from ? supabase.from("sales_docs").select("id, number").eq("id", doc.recurring_from).maybeSingle() : Promise.resolve({ data: null }),
    doc.subscription_id ? supabase.from("subscriptions").select("id, name").eq("id", doc.subscription_id).maybeSingle() : Promise.resolve({ data: null }),
    (async (): Promise<Recipient[]> => {
      if (doc.customer_id) {
        const { data } = await supabase.from("contacts").select("email, first_name, last_name, is_primary").eq("customer_id", doc.customer_id).not("email", "is", null).order("is_primary", { ascending: false });
        return (data ?? []).map((c) => ({ email: c.email!, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null }));
      }
      if (doc.lead_id) {
        const { data: l } = await supabase.from("leads").select("name, email").eq("id", doc.lead_id).maybeSingle();
        return l?.email ? [{ email: l.email, name: l.name }] : [];
      }
      return [];
    })(),
  ]);
  // Public link (Perfex's proposal link) and the discussion with the client
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? ""}`;
  const publicUrl = (kind === "estimate" || kind === "proposal") && doc.public_token ? `${origin}/p/${doc.public_token}` : null;
  const { data: comments } = kind === "estimate" || kind === "proposal"
    ? await supabase.from("sales_doc_comments").select("id, body, from_customer, author_name, created_at, staff_id, staff:profiles(full_name)").eq("doc_id", id).order("created_at")
    : { data: null };
  const label = docNumber(kind, doc.number);
  const tplVars = {
    contact_name: (recipients[0]?.name ?? "").split(" ")[0] || "there",
    customer: party.name,
    company_name: company?.company_name ?? "",
    doc_number: label,
    total: formatMoney(Number(doc.total), cur),
    due_date: doc.due_date ? formatDate(doc.due_date) : "on receipt",
    balance: formatMoney(bal?.balance ?? Number(doc.total), cur),
    subject: doc.subject ?? "",
    public_link: publicUrl ?? "",
  };
  // Estimates and proposals: offer an expiry reminder in the last week (or once expired), like Perfex
  const quote = kind === "estimate" || kind === "proposal";
  const expiring = quote && doc.status === "sent" && !!doc.due_date && doc.due_date <= daysFromToday(7);
  const [sendTpl, reminderTpl, expiryTpl] = await Promise.all([
    renderTemplate(supabase, `${kind}_send`, tplVars),
    status.key === "overdue" ? renderTemplate(supabase, "overdue_reminder", tplVars) : Promise.resolve(null),
    expiring ? renderTemplate(supabase, "expiry_reminder", tplVars) : Promise.resolve(null),
  ]);

  const hasMoney = (payments?.length ?? 0) > 0 || (credits?.length ?? 0) > 0;
  const converted = (derived ?? []).length > 0;
  const k = KINDS[kind];

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/sales/${k.slug}`} className="hover:text-brand-600">{k.plural}</Link>}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{docNumber(kind, doc.number)}</span>
            <Badge className={status.color}>{status.label}</Badge>
          </span>
        }
        description={
          party.href ? (
            <Link href={party.href} className="hover:text-brand-600">{party.name}</Link>
          ) : (
            party.name
          )
        }
        actions={
          <>
            <a href={`/print/${k.slug}/${id}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
              <Printer className="h-3.5 w-3.5" /> PDF / Print
            </a>
            {canEdit && doc.status !== "cancelled" && (
              <LinkButton href={`${docHref(kind, id)}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>
            )}
            {canEdit && (
              <form action={copyDoc}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="secondary" size="sm" pendingText="Copying…"><Copy className="h-3.5 w-3.5" /> Copy</SubmitButton>
              </form>
            )}
            {canEdit && doc.status === "draft" && <StatusButton id={id} status="sent" label="Mark as sent" icon={Send} variant="primary" />}
            {canEdit && (kind === "proposal" || kind === "estimate") && doc.status === "sent" && (
              <>
                <StatusButton id={id} status="accepted" label="Accepted" icon={Check} />
                <StatusButton id={id} status="declined" label="Declined" icon={X} />
              </>
            )}
            {canEdit && (kind === "proposal" || kind === "estimate") && !converted && !!doc.customer_id && doc.status !== "declined" && doc.status !== "cancelled" && (
              <>
                {kind === "proposal" && (
                  <form action={convertDoc}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="to" value="estimate" />
                    <SubmitButton variant="secondary" size="sm" pendingText="Converting…"><ArrowRightLeft className="h-3.5 w-3.5" /> To estimate</SubmitButton>
                  </form>
                )}
                <form action={convertDoc}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="to" value="invoice" />
                  <SubmitButton variant="accent" size="sm" pendingText="Converting…"><ArrowRightLeft className="h-3.5 w-3.5" /> Convert to invoice</SubmitButton>
                </form>
              </>
            )}
            {canEdit && (kind === "invoice" || kind === "credit_note") && doc.status !== "cancelled" && !hasMoney && (
              <StatusButton id={id} status="cancelled" label="Cancel" icon={Ban} />
            )}
            {/* A cancelled project invoice stays cancelled (its hours were released) — invoice the project again instead */}
            {canEdit && doc.status === "cancelled" && !(kind === "invoice" && doc.project_id) && <StatusButton id={id} status="draft" label="Reopen" icon={RotateCcw} />}
            {/* Documents with payments or applied credit can't be deleted (cancel them, or remove the money first) */}
            {canDelete && !hasMoney && (
              <ConfirmForm action={deleteDoc} message={`Delete ${docNumber(kind, doc.number)}? This can't be undone.`}>
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />

      {!doc.customer_id && doc.lead_id && (kind === "proposal") && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          This proposal is for a lead. To turn it into an estimate or invoice, first{" "}
          <Link href={`/leads/${doc.lead_id}`} className="font-semibold underline">convert the lead to a customer</Link>, then edit the proposal and pick that customer.
        </div>
      )}

      {(doc.recurring_every || template || sub) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm text-violet-900">
          <Repeat className="h-4 w-4 shrink-0 text-violet-600" />
          {doc.recurring_every ? (
            <span>
              <b>Recurring every {INTERVAL_LABEL(doc.recurring_every, doc.recurring_unit)}</b> · {doc.recurring_done} cop{doc.recurring_done === 1 ? "y" : "ies"} made
              {doc.recurring_cycles ? ` of ${doc.recurring_cycles}` : ""} · {doc.next_recurring_date ? `next on ${formatDate(doc.next_recurring_date)}` : "finished"}
            </span>
          ) : template ? (
            <span>Raised automatically from recurring invoice <Link href={docHref("invoice", template.id)} className="font-semibold underline">{docNumber("invoice", template.number)}</Link></span>
          ) : (
            <span>Billed by subscription <Link href={`/subscriptions/${sub!.id}`} className="font-semibold underline">{sub!.name}</Link></span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <DocPaper kind={kind} doc={doc} lines={lines ?? []} company={company} party={party} status={status} balance={bal} extra={extra} />

        <aside className="space-y-6">
          {canEdit && doc.status !== "cancelled" && (
            <Card>
              <CardHeader title="Send" description={doc.sent_at ? `Last marked sent ${formatDate(doc.sent_at)}` : "Not sent yet"} />
              <CardBody className="space-y-2">
                <SendEmailForm
                  action={sendDocEmail}
                  hidden={{ doc_id: id, kind: "document" }}
                  recipients={recipients}
                  subject={sendTpl?.subject ?? `${k.label} ${label}`}
                  body={sendTpl?.body ?? ""}
                  attachment={`${label}.pdf`}
                  label={`E-mail ${k.label.toLowerCase()}`}
                  tone={doc.status === "draft" ? "primary" : "secondary"}
                />
                {status.key === "overdue" && (
                  <SendEmailForm
                    action={sendDocEmail}
                    hidden={{ doc_id: id, kind: "overdue_reminder" }}
                    recipients={recipients}
                    subject={reminderTpl?.subject ?? `Reminder: invoice ${label} is overdue`}
                    body={reminderTpl?.body ?? ""}
                    attachment={`${label}.pdf`}
                    label="Send overdue reminder"
                    buttonLabel="Send reminder"
                    icon="bell"
                  />
                )}
                {status.key === "overdue" && doc.last_reminder_at && (
                  <p className="text-center text-xs text-slate-500">Last reminder {formatDate(doc.last_reminder_at)}</p>
                )}
                {expiring && (
                  <SendEmailForm
                    action={sendDocEmail}
                    hidden={{ doc_id: id, kind: "expiry_reminder" }}
                    recipients={recipients}
                    subject={expiryTpl?.subject ?? `Reminder: ${label} expires on ${formatDate(doc.due_date)}`}
                    body={expiryTpl?.body ?? ""}
                    attachment={`${label}.pdf`}
                    label={status.key === "expired" ? "Send reminder (expired)" : "Send expiry reminder"}
                    buttonLabel="Send reminder"
                    icon="bell"
                  />
                )}
                {expiring && doc.last_reminder_at && (
                  <p className="text-center text-xs text-slate-500">Expiry reminder sent {formatDate(doc.last_reminder_at)}</p>
                )}
              </CardBody>
            </Card>
          )}
          {quote && (
            <Card>
              <CardHeader
                title="Share & discuss"
                description={doc.first_viewed_at ? `Opened ${formatDateTime(doc.first_viewed_at)}${doc.last_viewed_at && doc.last_viewed_at !== doc.first_viewed_at ? ` · last ${formatDateTime(doc.last_viewed_at)}` : ""}` : publicUrl ? "Not opened yet" : "A link anyone can open — no sign-in needed"}
              />
              <CardBody className="space-y-3 text-sm">
                {publicUrl ? (
                  <>
                    <CopyLink url={publicUrl} />
                    {doc.status === "draft" && <p className="text-xs text-amber-700">Mark it as sent first — drafts don&apos;t open from the link.</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <a href={publicUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">Open as the client sees it</a>
                      {canEdit && (
                        <form action={disablePublicLink}>
                          <input type="hidden" name="id" value={id} />
                          <button className="text-slate-500 hover:text-rose-600">Turn off link</button>
                        </form>
                      )}
                    </div>
                  </>
                ) : (
                  canEdit && (
                    <form action={createPublicLink}>
                      <input type="hidden" name="id" value={id} />
                      <SubmitButton size="sm" variant="secondary" pendingText="Creating…">Create public link</SubmitButton>
                    </form>
                  )
                )}
                {canEdit && (
                  <form action={setAllowComments} className="text-xs">
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="allow" value={doc.allow_comments ? "0" : "1"} />
                    <button className="text-slate-500 hover:text-brand-700">{doc.allow_comments ? "Client comments are on — turn off" : "Client comments are off — turn on"}</button>
                  </form>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <div className="label">Discussion</div>
                  {!comments?.length && <p className="text-xs text-slate-400">No comments yet.</p>}
                  <ul className="space-y-2">
                    {(comments ?? []).map((c) => (
                      <li key={c.id} className={`group rounded-lg px-3 py-2 ${c.from_customer ? "bg-amber-50" : "bg-slate-50"}`}>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-slate-700">{c.from_customer ? `${c.author_name ?? "Client"} · client` : (c.staff?.full_name ?? "Staff")}</span>
                          <span className="text-slate-400" suppressHydrationWarning>{formatDateTime(c.created_at)}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{c.body}</p>
                        {canEdit && (
                          <ConfirmForm action={deleteDocComment} message="Delete this comment?">
                            <input type="hidden" name="id" value={c.id} />
                            <button className="mt-1 text-[11px] text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100">Delete</button>
                          </ConfirmForm>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canEdit && <div className="mt-2"><StaffCommentForm docId={id} /></div>}
                </div>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Total</span><b>{formatMoney(Number(doc.total), cur)}</b></div>
              {kind === "invoice" && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="text-emerald-600">{formatMoney(bal?.paid ?? 0, cur)}</span></div>
                  {(bal?.credited ?? 0) > 0 && <div className="flex justify-between"><span className="text-slate-500">Credits</span><span>{formatMoney(bal!.credited, cur)}</span></div>}
                  <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-medium">Balance due</span><b className="text-slate-900">{formatMoney(bal?.balance ?? Number(doc.total), cur)}</b></div>
                </>
              )}
              {kind === "credit_note" && (
                <div className="flex justify-between border-t border-slate-100 pt-2"><span className="font-medium">Credit remaining</span><b className="text-violet-700">{formatMoney(bal?.balance ?? Number(doc.total), cur)}</b></div>
              )}
              {doc.sent_at && <div className="flex justify-between text-xs text-slate-400"><span>Sent</span><span>{formatDate(doc.sent_at)}</span></div>}
              <div className="flex justify-between text-xs"><span className="text-slate-400">Sale agent</span><span className="text-slate-700">{agent?.full_name ?? "—"}</span></div>
              {doc.responded_by && (
                <div className={`rounded-lg px-3 py-2 text-xs ${doc.status === "accepted" ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"}`}>
                  <b>{doc.status === "accepted" ? "Accepted" : "Declined"} in the portal</b> by {doc.responded_by}
                  {doc.responded_at && <> · {formatDate(doc.responded_at)}</>}
                </div>
              )}
              {source && (
                <div className="flex justify-between text-xs"><span className="text-slate-400">Created from</span><Link href={docHref(source.kind, source.id)} className="font-mono text-brand-700">{docNumber(source.kind, source.number)}</Link></div>
              )}
              {(derived ?? []).map((d) => (
                <div key={d.id} className="flex justify-between text-xs"><span className="text-slate-400">Converted to</span><Link href={docHref(d.kind as DocKind, d.id)} className="font-mono text-brand-700">{docNumber(d.kind as DocKind, d.number)}</Link></div>
              ))}
            </CardBody>
          </Card>

          {kind === "invoice" && (
            <Card>
              <CardHeader title="Payments" />
              <CardBody className="space-y-3">
                {!payments?.length && <p className="text-sm text-slate-400">No payments yet.</p>}
                {payments?.map((pm) => (
                  <div key={pm.id} className="group flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <div className="font-semibold text-emerald-700">{formatMoney(Number(pm.amount), cur)}</div>
                      <div className="text-xs text-slate-500">{formatDate(pm.date)} · {pm.mode?.name ?? "—"}</div>
                      {pm.transaction_id && <div className="text-xs text-slate-400">Ref {pm.transaction_id}</div>}
                      <a href={`/print/receipt/${pm.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:underline">Receipt</a>
                    </div>
                    {canDelete && (
                      <ConfirmForm action={deletePayment} message="Delete this payment?">
                        <input type="hidden" name="id" value={pm.id} />
                        <input type="hidden" name="invoice_id" value={id} />
                        <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete payment"><Trash2 className="h-3.5 w-3.5" /></button>
                      </ConfirmForm>
                    )}
                  </div>
                ))}
                {(credits?.length ?? 0) > 0 && (
                  <div className="space-y-1 border-t border-slate-100 pt-3 text-xs">
                    {credits!.map((c) => (
                      <div key={c.id} className="flex justify-between">
                        <span className="text-slate-500">Credit from <Link href={docHref("credit_note", c.credit_note_id)} className="font-mono text-brand-700">{otherLabel(c.credit_note_id)}</Link></span>
                        <span>{formatMoney(Number(c.amount), cur)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && doc.status !== "cancelled" && (bal?.balance ?? 0) > 0.005 && (
                  <PaymentForm invoiceId={id} balance={bal!.balance} modes={modes ?? []} />
                )}
              </CardBody>
            </Card>
          )}

          {kind === "credit_note" && (
            <Card>
              <CardHeader title="Applied to invoices" />
              <CardBody className="space-y-3">
                {!credits?.length && <p className="text-sm text-slate-400">Not applied yet.</p>}
                {credits?.map((c) => (
                  <div key={c.id} className="group flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      <Link href={docHref("invoice", c.invoice_id)} className="font-mono text-brand-700">{otherLabel(c.invoice_id)}</Link>
                      <span className="ml-2 text-xs text-slate-400">{formatDate(c.date)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <b>{formatMoney(Number(c.amount), cur)}</b>
                      {canDelete && (
                        <ConfirmForm action={removeCredit} message="Remove this credit from the invoice?">
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Remove credit"><X className="h-3.5 w-3.5" /></button>
                        </ConfirmForm>
                      )}
                    </span>
                  </div>
                ))}
                {canEdit && status.key === "open" && doc.status !== "draft" && (
                  <div className="border-t border-slate-100 pt-3">
                    <ApplyCreditForm creditNoteId={id} available={bal?.balance ?? 0} invoices={openInvoices} />
                  </div>
                )}
                {doc.status === "draft" && <p className="text-xs text-slate-400">Mark the credit note as sent to apply it.</p>}
              </CardBody>
            </Card>
          )}
          {(copies?.length ?? 0) > 0 && (
            <Card>
              <CardHeader title="Recurring copies" description={`${copies!.length} raised so far`} />
              <ul className="divide-y divide-slate-100">
                {copies!.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <Link href={docHref("invoice", c.id)} className="font-mono font-semibold text-brand-700">{docNumber("invoice", c.number)}</Link>
                    <span className="text-slate-500">{formatDate(c.date)}</span>
                    <b>{formatMoney(Number(c.total), cur)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {adminNote && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Admin note</span>} description="Private — not on the PDF or in the portal" />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{adminNote.note}</p>
                <p className="mt-2 text-xs text-slate-400">{adminNote.by?.full_name ?? "—"} · {formatDate(adminNote.updated_at)}</p>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Attachments" description={files?.length ? `${files.length} file${files.length === 1 ? "" : "s"} · staff only` : "Staff only"} />
            <CardBody className="space-y-3">
              {(files ?? []).length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {files!.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <a href={`/sales/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700" title={`${kb(Number(f.size))} · ${f.uploader?.full_name ?? "—"}`}>{f.name}</a>
                      <a href={`/sales/files/${f.id}`} className="rounded p-1 text-slate-400 hover:text-brand-700" aria-label={`Download ${f.name}`}><Download className="h-4 w-4" /></a>
                      {canEdit && (
                        <ConfirmForm action={deleteDocFile} message={`Delete ${f.name}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={`Delete ${f.name}`}><Trash2 className="h-4 w-4" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? <FileUploader bucket="sales-files" relId={id} record={recordDocFile} /> : !files?.length && <p className="text-sm text-slate-400">No files.</p>}
            </CardBody>
          </Card>
          <CustomFieldsCard entity="sales_doc" relId={id} path={docHref(kind, id)} />
          <EmailHistory relType="sales_doc" relId={id} />
          <RemindersPanel relType="sales_doc" relId={id} path={docHref(kind, id)} />
          <RelatedTasks relType="sales_doc" relId={id} compact />
        </aside>
      </div>
    </>
  );
}
