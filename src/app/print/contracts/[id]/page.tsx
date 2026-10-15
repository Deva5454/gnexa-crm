import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractPaper } from "@/components/sales/contract-paper";
import { loadParty } from "@/components/sales/party";
import { requireStaff } from "@/lib/auth";
import { contractNumber } from "@/lib/constants";
import { companySettings } from "@/lib/sales-data";
import { PrintToolbar } from "../../[kind]/[id]/print-toolbar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: { absolute: contractNumber(Number((await params).id)) } };
}

export default async function PrintContractPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("contracts", "view")) notFound();
  const [{ data: c }, company] = await Promise.all([
    supabase.from("contracts").select("*, type:contract_types(name)").eq("id", id).maybeSingle(),
    companySettings(supabase),
  ]);
  if (!c) notFound();
  const { type, ...contract } = c;
  const party = await loadParty(supabase, { customer_id: c.customer_id, lead_id: null });
  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <PrintToolbar backHref={`/contracts/${id}`} name={contractNumber(id)} />
      <div className="px-4 print:px-0">
        <ContractPaper contract={contract} typeName={type?.name ?? null} company={company} party={party} />
      </div>
    </div>
  );
}
