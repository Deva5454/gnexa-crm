import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocPaper } from "@/components/sales/doc-paper";
import { loadParty } from "@/components/sales/party";
import { requireStaff } from "@/lib/auth";
import { pdfFields } from "@/lib/custom-fields";
import { docStatus, KINDS, type DocKind } from "@/lib/sales";
import { balancesFor, companySettings } from "@/lib/sales-data";
import { formatDate } from "@/lib/utils";
import { PrintToolbar } from "../[kind]/[id]/print-toolbar";

export const metadata: Metadata = { title: { absolute: "Bulk export" } };

const iso = (v: string | undefined, d: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : d);

export default async function BulkPrintPage({ searchParams }: { searchParams: Promise<{ kind?: string; from?: string; to?: string; status?: string }> }) {
  const sp = await searchParams;
  const kind = (sp.kind && sp.kind in KINDS ? sp.kind : "invoice") as DocKind;
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const from = iso(sp.from, "2000-01-01");
  const to = iso(sp.to, new Date().toISOString().slice(0, 10));
  let q = supabase.from("sales_docs").select("*").eq("kind", kind).gte("date", from).lte("date", to).order("date").order("number").limit(100);
  if (sp.status) q = q.eq("status", sp.status);
  else q = q.neq("status", "draft");
  const { data: docs } = await q;
  const ids = (docs ?? []).map((d) => d.id);
  const [company, bals, { data: lines }] = await Promise.all([
    companySettings(supabase),
    balancesFor(supabase, ids),
    ids.length ? supabase.from("sales_doc_items").select("*").in("doc_id", ids).order("position") : Promise.resolve({ data: [] }),
  ]);
  const items = await Promise.all(
    (docs ?? []).map(async (d) => ({ d, party: await loadParty(supabase, d), extra: await pdfFields(supabase, d.id) })),
  );
  const label = `${KINDS[kind].plural} ${formatDate(from)} – ${formatDate(to)}`;

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <PrintToolbar backHref="/bulk-pdf" name={label} />
      <p className="mx-auto mb-4 max-w-[860px] px-4 text-sm text-slate-500 print:hidden">{items.length} document{items.length === 1 ? "" : "s"} · {label}{items.length === 100 ? " · limited to the first 100 — narrow the dates for the rest" : ""}</p>
      {!items.length && <p className="mx-auto max-w-[860px] px-4 text-sm text-slate-500">Nothing matches — try a wider date range.</p>}
      <div className="space-y-6 px-4 print:space-y-0 print:px-0">
        {items.map(({ d, party, extra }) => (
          <div key={d.id} className="break-after-page">
            <DocPaper
              kind={kind}
              doc={d}
              lines={(lines ?? []).filter((l) => l.doc_id === d.id)}
              company={company}
              party={party}
              status={docStatus({ kind, status: d.status, due_date: d.due_date, total: Number(d.total) }, bals.get(d.id))}
              balance={bals.get(d.id)}
              extra={extra}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
