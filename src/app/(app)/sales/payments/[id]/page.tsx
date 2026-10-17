import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { EmailHistory } from "@/components/crm/email-history";
import { SendEmailForm } from "@/components/crm/send-email-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { paymentReceipt } from "@/lib/payment-receipt";
import { docHref, docNumber, docStatus, receiptNumber } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { deletePaymentRecord, sendPaymentReceipt } from "../actions";
import { EditPaymentForm } from "./edit-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: receiptNumber(Number((await params).id)) };
}

/** One payment (Perfex: Payments → a payment): details, edit, receipt PDF, e-mail the receipt, delete. */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view") || !Number.isInteger(id)) notFound();
  const { data: p } = await supabase
    .from("payments")
    .select("id, amount, date, mode_id, transaction_id, note, created_at, mode:payment_modes(name), recorder:profiles!payments_created_by_fkey(full_name), invoice:sales_docs(id, number, date, due_date, status, total, currency, customer:customers(id, company))")
    .eq("id", id)
    .maybeSingle();
  if (!p?.invoice) notFound();
  const inv = p.invoice;
  const cur = inv.currency;
  const canEdit = can("sales", "edit");

  const [bals, { data: modes }, { data: others }, receipt] = await Promise.all([
    balancesFor(supabase, [inv.id]),
    supabase.from("payment_modes").select("id, name").eq("is_active", true).neq("applies_to", "expenses").order("is_default", { ascending: false }).order("id"),
    supabase.from("payments").select("id, amount, date, mode:payment_modes(name)").eq("invoice_id", inv.id).neq("id", id).order("date"),
    canEdit ? paymentReceipt(supabase, id) : Promise.resolve(null),
  ]);
  const bal = bals.get(inv.id);
  const status = docStatus({ kind: "invoice", status: inv.status, due_date: inv.due_date, total: Number(inv.total) }, bal);
  // This payment's mode may have been switched off since; keep it selectable
  const modeList = p.mode_id && !(modes ?? []).some((m) => m.id === p.mode_id) ? [...(modes ?? []), { id: p.mode_id, name: p.mode?.name ?? "Current mode" }] : modes ?? [];

  const rows: [string, React.ReactNode][] = [
    ["Amount", <span key="a" className="text-lg font-bold text-emerald-700">{formatMoney(Number(p.amount), cur)}</span>],
    ["Payment date", formatDate(p.date)],
    ["Payment mode", p.mode?.name ?? "—"],
    ["Transaction / UTR no.", p.transaction_id ?? "—"],
    ["Customer", inv.customer ? <Link key="c" href={`/customers/${inv.customer.id}`} className="text-brand-700 hover:underline">{inv.customer.company}</Link> : "—"],
    ["Recorded", `${formatDateTime(p.created_at)}${p.recorder?.full_name ? ` by ${p.recorder.full_name}` : ""}`],
  ];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/sales/payments" className="hover:text-brand-600">Payments</Link>}
        title={<span className="font-mono">{receiptNumber(id)}</span>}
        description={<>Payment for <Link href={docHref("invoice", inv.id)} className="font-mono font-semibold text-brand-700 hover:underline">{docNumber("invoice", inv.number)}</Link></>}
        actions={
          <>
            <a href={`/print/receipt/${id}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary" })}><Printer className="h-4 w-4" /> Receipt PDF</a>
            {can("sales", "full") && (
              <ConfirmForm action={deletePaymentRecord} message={`Delete this payment of ${formatMoney(Number(p.amount), cur)}? The invoice goes back to owing it.`}>
                <input type="hidden" name="id" value={id} />
                <Button variant="secondary" className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Delete</Button>
              </ConfirmForm>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Payment" />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium text-slate-500">{k}</dt>
                    <dd className="mt-0.5 text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.note && (
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <div className="text-xs font-medium text-slate-500">Note</div>
                  <p className="whitespace-pre-wrap">{p.note}</p>
                </div>
              )}
              {canEdit && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <EditPaymentForm
                    payment={{ id, amount: Number(p.amount), date: p.date, mode_id: p.mode_id, transaction_id: p.transaction_id, note: p.note }}
                    modes={modeList}
                    max={Math.round((Number(p.amount) + Math.max(0, bal?.balance ?? 0)) * 100) / 100}
                  />
                </div>
              )}
            </CardBody>
          </Card>
          <EmailHistory relType="payment" relId={id} />
        </div>

        <div className="space-y-6">
          {receipt && (
            <Card>
              <CardHeader title="Send receipt" description="E-mail this payment receipt to the customer" />
              <CardBody>
                {receipt.recipients.length ? (
                  <SendEmailForm
                    action={sendPaymentReceipt}
                    hidden={{ payment_id: id }}
                    recipients={receipt.recipients}
                    subject={receipt.subject}
                    body={receipt.body}
                    attachment={`${receiptNumber(id)}.pdf`}
                    label="E-mail receipt"
                    tone="primary"
                  />
                ) : (
                  <p className="text-sm text-slate-500">This customer has no contact with an e-mail address.</p>
                )}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Invoice" />
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link href={docHref("invoice", inv.id)} className="font-mono font-semibold text-brand-700 hover:underline">{docNumber("invoice", inv.number)}</Link>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Invoice date</span><span>{formatDate(inv.date)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total</span><span>{formatMoney(Number(inv.total), cur)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid</span><span className="text-emerald-700">{formatMoney(bal?.paid ?? 0, cur)}</span></div>
              {(bal?.credited ?? 0) + (bal?.credit_used ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Credits</span><span>{formatMoney((bal?.credited ?? 0) + (bal?.credit_used ?? 0), cur)}</span></div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><span>Balance due</span><span>{formatMoney(Math.max(0, bal?.balance ?? 0), cur)}</span></div>
              {(others?.length ?? 0) > 0 && (
                <div className="space-y-1 border-t border-slate-100 pt-2">
                  <div className="text-xs font-medium text-slate-500">Other payments on this invoice</div>
                  {others!.map((o) => (
                    <Link key={o.id} href={`/sales/payments/${o.id}`} className="flex justify-between text-xs hover:text-brand-700">
                      <span>{formatDate(o.date)} · {o.mode?.name ?? "—"}</span>
                      <span>{formatMoney(Number(o.amount), cur)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
