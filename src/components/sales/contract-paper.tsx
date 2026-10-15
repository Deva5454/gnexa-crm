import { LogoMark } from "@/components/layout/logo";
import type { Tables } from "@/lib/database.types";
import { contractNumber } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/utils";
import type { Party } from "./doc-paper";

/** Printable agreement with signature blocks. */
export function ContractPaper({
  contract: c,
  typeName,
  company,
  party,
}: {
  contract: Tables<"contracts">;
  typeName: string | null;
  company: Tables<"company_settings"> | null;
  party: Party;
}) {
  return (
    <article className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <div className="h-1.5 bg-aurora print:[print-color-adjust:exact]" />
      <div className="p-6 sm:p-10">
        <header className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <div>
              <div className="font-bold text-slate-900">{company?.company_name}</div>
              {company?.gstin && <div className="text-xs text-slate-500">GSTIN {company.gstin}</div>}
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{typeName ?? "Agreement"}</div>
            <div className="font-mono text-sm text-slate-500">{contractNumber(c.id)}</div>
          </div>
        </header>

        <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">{c.subject}</h1>
        <p className="mt-3 text-sm text-slate-600">
          This agreement is made between <b>{company?.company_name}</b> (“the Provider”) and <b>{party.name}</b> (“the Customer”), effective{" "}
          <b>{formatDate(c.start_date)}</b>{c.end_date ? <> until <b>{formatDate(c.end_date)}</b></> : " until terminated"}.
          {c.value != null && <> The total contract value is <b>{formatMoney(Number(c.value))}</b> plus applicable taxes.</>}
        </p>

        <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.content}</div>

        <section className="mt-12 grid gap-10 sm:grid-cols-2">
          {[
            { who: company?.company_name ?? "Provider", name: null as string | null, date: null as string | null },
            { who: party.name, name: c.signed_by, date: c.signed_at },
          ].map((s) => (
            <div key={s.who}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">For {s.who}</div>
              <div className="flex h-14 items-end border-b border-slate-300 pb-1 font-serif text-xl italic text-brand-800">{s.name}</div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Name & signature</span>
                <span>{s.date ? `Signed ${formatDate(s.date)}` : "Date"}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
