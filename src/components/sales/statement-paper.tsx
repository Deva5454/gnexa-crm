import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";
import type { Tables } from "@/lib/database.types";
import type { Statement } from "@/lib/statement";
import { cn, formatDate } from "@/lib/utils";
import type { Party } from "./doc-paper";

const money = (n: number, cur: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, minimumFractionDigits: 2 }).format(n);

/** Account statement — on screen and for print/PDF. */
export function StatementPaper({ s, company, party, linkRows = true }: { s: Statement; company: Tables<"company_settings"> | null; party: Party; linkRows?: boolean }) {
  const cur = s.currency;
  return (
    <article className="doc-paper relative mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
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
            <div className="text-2xl font-bold uppercase tracking-wide text-slate-900">Statement</div>
            <div className="mt-0.5 text-sm text-slate-500">{formatDate(s.from)} – {formatDate(s.to)}</div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 border-y border-slate-100 py-6 sm:grid-cols-2">
          <div className="text-sm">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Account of</div>
            <div className="font-semibold text-slate-900">{party.name}</div>
            {party.contact && <div className="text-slate-600">Attn: {party.contact}</div>}
            {party.lines.map((l) => <div key={l} className="text-slate-500">{l}</div>)}
            {party.gstin && <div className="mt-1 text-slate-500">GSTIN: <span className="font-medium text-slate-700">{party.gstin}</span></div>}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:justify-self-end">
            <dt className="text-slate-400">Opening balance</dt><dd className="text-right font-medium tabular-nums">{money(s.opening, cur)}</dd>
            <dt className="text-slate-400">Invoiced</dt><dd className="text-right font-medium tabular-nums">{money(s.invoiced, cur)}</dd>
            <dt className="text-slate-400">Payments & credits</dt><dd className="text-right font-medium tabular-nums">{money(s.received, cur)}</dd>
            <dt className="border-t border-slate-200 pt-2 font-semibold text-slate-700">Balance due</dt>
            <dd className={cn("border-t border-slate-200 pt-2 text-right font-bold tabular-nums", s.closing > 0.005 ? "text-slate-900" : "text-emerald-600")}>{money(s.closing, cur)}</dd>
          </dl>
        </section>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Reference</th>
                <th className="hidden py-2 pr-3 font-semibold lg:table-cell">Details</th>
                <th className="py-2 pr-3 text-right font-semibold">Debit</th>
                <th className="py-2 pr-3 text-right font-semibold">Credit</th>
                <th className="py-2 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-slate-100 text-slate-500">
                <td className="py-2 pr-3">{formatDate(s.from)}</td>
                <td className="py-2 pr-3">Opening balance</td>
                <td className="hidden lg:table-cell" />
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3" />
                <td className="whitespace-nowrap py-2 text-right font-medium text-slate-700">{money(s.opening, cur)}</td>
              </tr>
              {s.rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatDate(r.date)}</td>
                  <td className="max-w-[120px] truncate py-2 pr-3 font-mono text-xs" title={r.ref}>
                    {linkRows ? <Link href={r.href} className="text-brand-700 hover:underline print:text-slate-800">{r.ref}</Link> : r.ref}
                  </td>
                  <td className="hidden max-w-[200px] truncate py-2 pr-3 text-slate-500 lg:table-cell" title={r.detail}>{r.detail}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right">{r.debit ? money(r.debit, cur) : ""}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right text-emerald-700">{r.credit ? money(r.credit, cur) : ""}</td>
                  <td className="whitespace-nowrap py-2 text-right font-medium">{money(r.balance, cur)}</td>
                </tr>
              ))}
              {!s.rows.length && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-400">No transactions in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-xs text-slate-400">Debits are invoices raised; credits are payments received and credit notes issued. Amounts include GST.</p>
      </div>
    </article>
  );
}
