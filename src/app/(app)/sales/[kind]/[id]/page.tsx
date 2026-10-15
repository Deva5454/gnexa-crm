import type { Metadata } from "next";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightLeft, Ban, Check, Pencil, Printer, Repeat, RotateCcw, Send, Trash2, X } from "lucide-react";
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
import { formatDate, formatMoney } from "@/lib/utils";
import { convertDoc, deleteDoc, deletePayment, removeCredit, setDocStatus } from "../../actions";
import { ApplyCreditForm, PaymentForm } from "./panels";

export const metadata: Metadata = { title: "Document" };

const k0 = (kind: DocKind) => KINDS[kind].label.toLowerCase();

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

  const [{ data: doc }, { data: lines }, company] = await Promise.all([
    supabase.from("sales_docs").select("*").eq("id", id).eq("kind", kind).maybeSingle(),
    supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position"),
    companySettings(supabase),
  ]);
  if (!doc) notFound();

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
  const label = docNumber(kind, doc.number);
  const first = (recipients[0]?.name ?? "").split(" ")[0] || "there";
  const balanceText = formatMoney(bal?.balance ?? Number(doc.total), cur);
  const emailBody =
    kind === "invoice"
      ? `Hi ${first},\n\nPlease find attached invoice ${label} for ${formatMoney(Number(doc.total), cur)}${doc.due_date ? `, due on ${formatDate(doc.due_date)}` : ""}.\n\nYou can view and pay it online from your client portal.\n\nRegards,\n${company?.company_name ?? ""}`
      : kind === "credit_note"
        ? `Hi ${first},\n\nPlease find attached credit note ${label} for ${formatMoney(Number(doc.total), cur)}.\n\nRegards,\n${company?.company_name ?? ""}`
        : `Hi ${first},\n\nPlease find attached our ${k0(kind)} ${label}${doc.subject ? ` for “${doc.subject}”` : ""}. You can review and accept it online from your client portal.\n\nLet me know if you have any questions.\n\nRegards,\n${company?.company_name ?? ""}`;
  const reminderBody = `Hi ${first},\n\nThis is a friendly reminder that invoice ${label} was due on ${formatDate(doc.due_date)} and ${balanceText} is still outstanding.\n\nIf you have already paid, please ignore this message.\n\nRegards,\n${company?.company_name ?? ""}`;

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
            {canEdit && doc.status === "draft" && <StatusButton id={id} status="sent" label="Mark as sent" icon={Send} variant="primary" />}
            {canEdit && (kind === "proposal" || kind === "estimate") && doc.status === "sent" && (
              <>
                <StatusButton id={id} status="accepted" label="Accepted" icon={Check} />
                <StatusButton id={id} status="declined" label="Declined" icon={X} />
              </>
            )}
            {canEdit && (kind === "proposal" || kind === "estimate") && !converted && doc.status !== "declined" && doc.status !== "cancelled" && (
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
            {canEdit && doc.status === "cancelled" && <StatusButton id={id} status="draft" label="Reopen" icon={RotateCcw} />}
            {canDelete && (
              <ConfirmForm action={deleteDoc} message={`Delete ${docNumber(kind, doc.number)}?${hasMoney ? " Its payments and credits are deleted too." : ""}`}>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <DocPaper kind={kind} doc={doc} lines={lines ?? []} company={company} party={party} status={status} balance={bal} />

        <aside className="space-y-6">
          {canEdit && doc.status !== "cancelled" && (
            <Card>
              <CardHeader title="Send" description={doc.sent_at ? `Last marked sent ${formatDate(doc.sent_at)}` : "Not sent yet"} />
              <CardBody className="space-y-2">
                <SendEmailForm
                  action={sendDocEmail}
                  hidden={{ doc_id: id, kind: "document" }}
                  recipients={recipients}
                  subject={`${k.label} ${label} from ${company?.company_name ?? "us"}`}
                  body={emailBody}
                  attachment={`${label}.pdf`}
                  label={`E-mail ${k.label.toLowerCase()}`}
                  tone={doc.status === "draft" ? "primary" : "secondary"}
                />
                {status.key === "overdue" && (
                  <SendEmailForm
                    action={sendDocEmail}
                    hidden={{ doc_id: id, kind: "overdue_reminder" }}
                    recipients={recipients}
                    subject={`Reminder: invoice ${label} is overdue`}
                    body={reminderBody}
                    attachment={`${label}.pdf`}
                    label="Send overdue reminder"
                    buttonLabel="Send reminder"
                    icon="bell"
                  />
                )}
                {status.key === "overdue" && doc.last_reminder_at && (
                  <p className="text-center text-xs text-slate-500">Last reminder {formatDate(doc.last_reminder_at)}</p>
                )}
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
                    </div>
                    {canDelete && (
                      <ConfirmForm action={deletePayment} message="Delete this payment?">
                        <input type="hidden" name="id" value={pm.id} />
                        <input type="hidden" name="invoice_id" value={id} />
                        <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete payment"><Trash2 className="h-3.5 w-3.5" /></button>
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
                          <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label="Remove credit"><X className="h-3.5 w-3.5" /></button>
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
          <EmailHistory relType="sales_doc" relId={id} />
          <RemindersPanel relType="sales_doc" relId={id} path={docHref(kind, id)} />
        </aside>
      </div>
    </>
  );
}
