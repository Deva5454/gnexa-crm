import { pdfFields } from "@/lib/custom-fields";
import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";
import { DocPaper } from "@/components/sales/doc-paper";
import { loadParty } from "@/components/sales/party";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { docStatus, KINDS, type DocKind } from "@/lib/sales";
import { balancesFor, companySettings, invoicePayOptions } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";
import { PrintButton, QuoteResponse } from "./forms";
import { PayNow } from "./pay-now";

/** A client's view of one of their documents (RLS only returns their own, non-draft documents). */
export async function PortalDocView({ id, kinds }: { id: number; kinds: DocKind[] }) {
  const { supabase, contactName } = await requirePortal();
  const [{ data: doc }, { data: lines }, company, payOptions, bals, extra] = await Promise.all([
    supabase.from("sales_docs").select("*").eq("id", id).in("kind", kinds).maybeSingle(),
    supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position"),
    companySettings(supabase),
    invoicePayOptions(supabase),
    balancesFor(supabase, [id]),
    pdfFields(supabase, id),
  ]);
  if (!doc) notFound();
  const kind = doc.kind as DocKind;
  const party = await loadParty(supabase, doc);
  const bal = bals.get(id);
  const st = docStatus({ kind, status: doc.status, due_date: doc.due_date, total: Number(doc.total) }, bal);
  const { data: payments } = kind === "invoice" ? await supabase.from("payments").select("id, amount, date, transaction_id, mode:payment_modes(name)").eq("invoice_id", id).order("date") : { data: [] };
  const canRespond = (kind === "estimate" || kind === "proposal") && doc.status === "sent" && st.key !== "expired";

  return (
    <>
      <div className="mb-5 flex items-center justify-end print:hidden">
        <PrintButton />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] print:block">
        <DocPaper kind={kind} doc={doc} lines={lines ?? []} company={company} party={party} status={st} balance={bal} extra={extra} payOptions={payOptions} />
        <aside className="space-y-6 print:hidden">
          {doc.responded_by && (doc.status === "accepted" || doc.status === "declined") && (
            <Card>
              <CardBody className="text-sm">
                <div className={doc.status === "accepted" ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>
                  {doc.status === "accepted" ? "Accepted" : "Declined"} by {doc.responded_by}
                </div>
                {doc.responded_at && <div className="text-xs text-slate-500">{formatDate(doc.responded_at)}</div>}
              </CardBody>
            </Card>
          )}
          {canRespond && (
            <Card>
              <CardHeader title={`Respond to this ${KINDS[kind].label.toLowerCase()}`} description={doc.due_date ? `Valid until ${formatDate(doc.due_date)}` : undefined} />
              <CardBody><QuoteResponse id={id} kindLabel={KINDS[kind].label} defaultName={contactName} /></CardBody>
            </Card>
          )}
          {kind === "invoice" && (bal?.balance ?? 0) > 0.005 && doc.status !== "cancelled" && (
            <Card>
              <CardHeader title="Pay this invoice" />
              <CardBody className="space-y-4 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Amount due</div>
                  <div className="text-2xl font-bold text-slate-900">{formatMoney(bal!.balance, doc.currency)}</div>
                  {doc.due_date && <div className="text-xs text-slate-500">by {formatDate(doc.due_date)}</div>}
                </div>
                <PayNow id={id} balance={bal!.balance} currency={doc.currency} />
                {company?.bank_details && (
                  <details className="border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">Prefer a bank transfer?</summary>
                    <div className="mt-2 flex gap-2 text-slate-600"><Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><p className="whitespace-pre-wrap">{company.bank_details}</p></div>
                    <p className="mt-1 text-xs text-slate-400">Please quote the invoice number with your payment.</p>
                  </details>
                )}
              </CardBody>
            </Card>
          )}
          {kind === "invoice" && (payments?.length ?? 0) > 0 && (
            <Card>
              <CardHeader title="Payments received" />
              <ul className="divide-y divide-slate-100">
                {payments!.map((p) => (
                  <li key={p.id} className="flex justify-between px-5 py-3 text-sm">
                    <span><span className="text-slate-700">{formatDate(p.date)}</span><span className="block text-xs text-slate-400">{p.mode?.name}{p.transaction_id ? ` · ${p.transaction_id}` : ""}</span></span>
                    <b className="text-emerald-700">{formatMoney(Number(p.amount), doc.currency)}</b>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
