import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { ContractPaper } from "@/components/sales/contract-paper";
import { loadParty } from "@/components/sales/party";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { companySettings } from "@/lib/sales-data";
import { formatDate } from "@/lib/utils";
import { PrintButton, SignContractForm } from "../../forms";

export const metadata: Metadata = { title: "Contract" };

export default async function PortalContract({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, contactName } = await requirePortal();
  const [{ data: c }, company] = await Promise.all([supabase.from("contracts").select("*, type:contract_types(name)").eq("id", id).maybeSingle(), companySettings(supabase)]);
  if (!c) notFound();
  const { type, ...contract } = c;
  const party = await loadParty(supabase, { customer_id: c.customer_id, lead_id: null });
  return (
    <>
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link href="/portal/contracts" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> All contracts</Link>
        <PrintButton />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] print:block">
        <ContractPaper contract={contract} typeName={type?.name ?? null} company={company} party={party} />
        <aside className="print:hidden">
          {c.status === "sent" ? (
            <Card>
              <CardHeader title="Sign this agreement" description="Read the terms, then sign below." />
              <CardBody><SignContractForm id={id} defaultName={contactName} /></CardBody>
            </Card>
          ) : c.status === "signed" ? (
            <Card className="p-5 text-sm">
              <CheckCircle2 className="mb-2 h-6 w-6 text-accent-500" />
              Signed by <b>{c.signed_by}</b>{c.signed_at && <> on {formatDate(c.signed_at)}</>}.
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
