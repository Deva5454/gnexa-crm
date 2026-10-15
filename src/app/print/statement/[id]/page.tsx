import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadParty } from "@/components/sales/party";
import { StatementPaper } from "@/components/sales/statement-paper";
import { requireStaff } from "@/lib/auth";
import { companySettings } from "@/lib/sales-data";
import { buildStatement, defaultRange } from "@/lib/statement";
import { PrintToolbar } from "../../[kind]/[id]/print-toolbar";

export const metadata: Metadata = { title: { absolute: "Statement" } };

const iso = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function PrintStatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const def = defaultRange();
  const from = iso(sp.from) ?? def.from;
  const to = iso(sp.to) ?? def.to;
  const [company, s] = await Promise.all([companySettings(supabase), buildStatement(supabase, id, from, to)]);
  const party = await loadParty(supabase, { customer_id: id, lead_id: null });
  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <PrintToolbar backHref={`/customers/${id}/statement?from=${from}&to=${to}`} name={`Statement ${party.name}`} />
      <div className="px-4 print:px-0">
        <StatementPaper s={s} company={company} party={party} linkRows={false} />
      </div>
    </div>
  );
}
