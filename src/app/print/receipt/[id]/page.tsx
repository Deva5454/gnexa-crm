import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/layout/logo";
import { loadParty } from "@/components/sales/party";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber } from "@/lib/sales";
import { balancesFor, companySettings } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";
import { PrintToolbar } from "../../[kind]/[id]/print-toolbar";

const receiptNo = (id: number) => `RCPT-${String(id).padStart(5, "0")}`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  // Browsers use the title as the default PDF file name
  return { title: { absolute: receiptNo(Number((await params).id)) } };
}

/** Perfex "Payment receipt": proof of one payment against an invoice, for print / PDF. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const { data: pay } = await supabase.from("payments").select("id, invoice_id, amount, date, transaction_id, note, mode:payment_modes(name)").eq("id", id).maybeSingle();
  if (!pay) notFound();
  const { data: inv } = await supabase.from("sales_docs").select("*").eq("id", pay.invoice_id).eq("kind", "invoice").maybeSingle();
  if (!inv) notFound();
  const [company, party, bals] = await Promise.all([companySettings(supabase), loadParty(supabase, inv), balancesFor(supabase, [inv.id])]);
  const bal = bals.get(inv.id);
  const cur = inv.currency;
  const rows: [string, string][] = [
    ["Payment date", formatDate(pay.date)],
    ["Payment mode", pay.mode?.name ?? "—"],
    ...(pay.transaction_id ? ([["Transaction ID", pay.transaction_id]] as [string, string][]) : []),
    ["Invoice", docNumber("invoice", inv.number)],
    ["Invoice date", formatDate(inv.date)],
    ["Invoice total", formatMoney(Number(inv.total), cur)],
    ["Balance due now", formatMoney(Math.max(0, bal?.balance ?? 0), cur)],
  ];

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <PrintToolbar backHref={docHref("invoice", inv.id)} name={receiptNo(pay.id)} />
      <div className="px-4 print:px-0">
        <article className="mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
          <div className="h-1.5 bg-aurora print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]" />
          <div className="p-6 sm:p-10">
            <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <LogoMark className="h-11 w-11 shrink-0" />
                <div className="text-sm">
                  <div className="text-base font-bold text-slate-900">{company?.company_name ?? "Gnexa"}</div>
                  {company?.address?.split("\n").map((l) => <div key={l} className="text-slate-500">{l}</div>)}
                  {company?.gstin && <div className="mt-1 text-slate-500">GSTIN: <span className="font-medium text-slate-700">{company.gstin}</span></div>}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-2xl font-bold uppercase tracking-wide text-slate-900">Payment receipt</div>
                <div className="mt-0.5 font-mono text-sm text-slate-500">{receiptNo(pay.id)}</div>
              </div>
            </header>

            <section className="mt-8 grid gap-6 border-y border-slate-100 py-6 sm:grid-cols-2">
              <div className="text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Received from</div>
                <div className="font-semibold text-slate-900">{party.name}</div>
                {party.lines.map((l) => <div key={l} className="text-slate-500">{l}</div>)}
                {party.gstin && <div className="mt-1 text-slate-500">GSTIN: <span className="font-medium text-slate-700">{party.gstin}</span></div>}
              </div>
              <div className="rounded-xl bg-emerald-50 p-5 text-center sm:justify-self-end sm:text-right print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Amount received</div>
                <div className="mt-1 text-3xl font-bold text-emerald-700">{formatMoney(Number(pay.amount), cur)}</div>
              </div>
            </section>

            <dl className="mt-6 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            {pay.note && <p className="mt-6 whitespace-pre-wrap text-sm text-slate-600">{pay.note}</p>}
            <p className="mt-10 text-center text-xs text-slate-400">Thank you for your payment. This receipt was generated electronically and needs no signature.</p>
          </div>
        </article>
      </div>
    </div>
  );
}
