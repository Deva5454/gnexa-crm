import { LogoMark } from "@/components/layout/logo";
import { Fragment } from "react";
import type { Tables } from "@/lib/database.types";
import { placeOfSupply, taxComponents, type SupplyType } from "@/lib/gst";
import { computeTotals, docNumber, KINDS, type DocKind, type StatusView } from "@/lib/sales";
import { proposalVars, RichText } from "./rich-text";
import type { Balance } from "@/lib/sales-data";
import { cn, formatDate } from "@/lib/utils";

export type Party = { name: string; lines: string[]; gstin?: string | null; contact?: string | null };

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

/** The document itself — used on screen and for the printable PDF. */
export function DocPaper({
  kind,
  doc,
  lines,
  company,
  party,
  status,
  balance,
  extra = [],
  payOptions = [],
}: {
  kind: DocKind;
  doc: Tables<"sales_docs">;
  lines: Tables<"sales_doc_items">[];
  company: Tables<"company_settings"> | null;
  party: Party;
  status: StatusView;
  balance?: Balance;
  /** Custom fields marked "show on PDF" */
  extra?: { label: string; value: string }[];
  /** Payment modes shown on invoices as ways to pay */
  payOptions?: { name: string; description: string | null }[];
}) {
  const k = KINDS[kind];
  const cur = doc.currency || "INR";
  const totals = computeTotals(
    lines.map((l) => ({ description: l.description, qty: Number(l.qty), rate: Number(l.rate), tax_rate: Number(l.tax_rate) })),
    Number(doc.discount_percent),
    Number(doc.adjustment),
  );
  const isInvoice = kind === "invoice";
  const supply = (doc.supply_type ?? "intra") as SupplyType;
  const pos = placeOfSupply(doc.place_of_supply);
  const showHsn = lines.some((l) => l.hsn_sac);
  const received = (balance?.paid ?? 0) + (balance?.credited ?? 0);

  return (
    <article className="doc-paper relative mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <div className="h-1.5 bg-aurora print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]" />
      <div className="p-6 sm:p-10">
        {/* Header */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <LogoMark className="h-11 w-11 shrink-0" />
            <div className="text-sm">
              <div className="text-base font-bold text-slate-900">{company?.company_name ?? "Gnexa"}</div>
              {company?.address?.split("\n").map((l) => <div key={l} className="text-slate-500">{l}</div>)}
              {company?.gstin && <div className="mt-1 text-slate-500">GSTIN: <span className="font-medium text-slate-700">{company.gstin}</span></div>}
              {(company?.email || company?.phone) && (
                <div className="text-slate-500">{[company.phone, company.email].filter(Boolean).join(" · ")}</div>
              )}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-2xl font-bold uppercase tracking-wide text-slate-900">{k.label}</div>
            <div className="mt-0.5 font-mono text-sm text-slate-500">{docNumber(kind, doc.number)}</div>
            <span className={cn("mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset print:hidden", status.color)}>
              {status.label}
            </span>
          </div>
        </header>

        {/* Parties & dates */}
        <section className="mt-8 grid gap-6 border-y border-slate-100 py-6 sm:grid-cols-2">
          <div className="text-sm">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{k.partyLabel}</div>
            <div className="font-semibold text-slate-900">{party.name}</div>
            {party.contact && <div className="text-slate-600">Attn: {party.contact}</div>}
            {party.lines.map((l) => <div key={l} className="text-slate-500">{l}</div>)}
            {party.gstin && <div className="mt-1 text-slate-500">GSTIN: <span className="font-medium text-slate-700">{party.gstin}</span></div>}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:justify-self-end">
            <dt className="text-slate-400">{k.label} date</dt>
            <dd className="text-right font-medium">{formatDate(doc.date)}</dd>
            {k.dueLabel && (
              <>
                <dt className="text-slate-400">{k.dueLabel}</dt>
                <dd className="text-right font-medium">{formatDate(doc.due_date)}</dd>
              </>
            )}
            {pos && (
              <>
                <dt className="text-slate-400">Place of supply</dt>
                <dd className="text-right font-medium">{pos}</dd>
              </>
            )}
            {extra.map((x) => (
              <Fragment key={x.label}>
                <dt className="text-slate-400">{x.label}</dt>
                <dd className="text-right font-medium">{x.value}</dd>
              </Fragment>
            ))}
            {isInvoice && (
              <>
                <dt className="text-slate-400">Balance due</dt>
                <dd className="text-right font-bold text-slate-900">{money(balance?.balance ?? Number(doc.total), cur)}</dd>
              </>
            )}
          </dl>
        </section>

        {doc.subject && <h2 className="mt-6 text-lg font-semibold text-slate-900">{doc.subject}</h2>}
        {kind === "proposal" && doc.content && (
          <RichText
            text={doc.content}
            className="mt-3 text-sm leading-relaxed text-slate-600"
            vars={proposalVars({
              customer: party.name,
              number: docNumber(kind, doc.number),
              total: money(Number(doc.total), cur),
              openTill: formatDate(doc.due_date),
              date: formatDate(doc.date),
              company: company?.company_name ?? "",
            })}
          />
        )}

        {/* Lines */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-900 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="w-8 py-2 pr-2">#</th>
                <th className="py-2 pr-4">Item</th>
                {showHsn && <th className="py-2 pr-4">HSN / SAC</th>}
                <th className="py-2 pr-4 text-right">Qty</th>
                <th className="py-2 pr-4 text-right">Rate</th>
                <th className="py-2 pr-4 text-right">Tax</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-slate-900">{l.description}</div>
                    {l.long_description && <div className="whitespace-pre-wrap text-xs text-slate-500">{l.long_description}</div>}
                  </td>
                  {showHsn && <td className="py-3 pr-4 font-mono text-xs text-slate-600">{l.hsn_sac ?? "—"}</td>}
                  <td className="whitespace-nowrap py-3 pr-4 text-right">
                    {Number(l.qty)} {l.unit && <span className="text-slate-400">{l.unit}</span>}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right">{money(Number(l.rate), cur)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right text-slate-500">{Number(l.tax_rate) ? `${Number(l.tax_rate)}%` : "—"}</td>
                  <td className="whitespace-nowrap py-3 text-right font-medium">{money(Number(l.qty) * Number(l.rate), cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Sub total" value={money(totals.subtotal, cur)} />
            {totals.discount_total > 0 && <Row label={`Discount (${Number(doc.discount_percent)}%)`} value={`− ${money(totals.discount_total, cur)}`} />}
            {totals.taxes.flatMap((t) =>
              taxComponents(t.rate, t.amount, supply).map((c) => (
                <Row key={`${t.rate}-${c.label}`} label={c.label} sub={`on ${money(t.taxable, cur)}`} value={money(c.amount, cur)} />
              )),
            )}
            {supply === "export" && totals.taxes.length > 0 && <p className="text-[10px] text-slate-400">Export of goods or services.</p>}
            {Number(doc.adjustment) !== 0 && <Row label="Adjustment" value={money(Number(doc.adjustment), cur)} />}
            <div className="!mt-3 flex items-center justify-between border-t-2 border-slate-900 pt-3 text-base font-bold text-slate-900">
              <span>Total</span>
              <span>{money(Number(doc.total), cur)}</span>
            </div>
            {isInvoice && received > 0 && (
              <>
                {balance!.paid > 0 && <Row label="Payments received" value={`− ${money(balance!.paid, cur)}`} />}
                {balance!.credited > 0 && <Row label="Credits applied" value={`− ${money(balance!.credited, cur)}`} />}
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 font-bold text-slate-900 print:bg-transparent print:px-0">
                  <span>Balance due</span>
                  <span>{money(balance!.balance, cur)}</span>
                </div>
              </>
            )}
            {kind === "credit_note" && balance && (
              <Row label="Credit remaining" value={money(balance.balance, cur)} />
            )}
          </dl>
        </div>

        {/* Footer */}
        <footer className="mt-10 grid gap-6 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2">
          {doc.notes && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes</div>
              <p className="whitespace-pre-wrap text-slate-600">{doc.notes}</p>
            </div>
          )}
          {doc.terms && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Terms & conditions</div>
              <p className="whitespace-pre-wrap text-slate-600">{doc.terms}</p>
            </div>
          )}
          {isInvoice && company?.bank_details && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pay to</div>
              <p className="whitespace-pre-wrap text-slate-600">{company.bank_details}</p>
            </div>
          )}
          {isInvoice && payOptions.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ways to pay</div>
              <ul className="space-y-1.5">
                {payOptions.map((m) => (
                  <li key={m.name} className="text-slate-600">
                    <span className="font-medium text-slate-700">{m.name}</span>
                    {m.description && <span className="block whitespace-pre-wrap">{m.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </footer>
        <p className="mt-10 text-center text-[11px] text-slate-400">This is a computer-generated document and does not require a signature.</p>
      </div>
    </article>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">
        {label}
        {sub && <span className="block text-[10px] text-slate-400">{sub}</span>}
      </span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
