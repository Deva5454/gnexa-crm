import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { ContractPaper } from "@/components/sales/contract-paper";
import { loadParty } from "@/components/sales/party";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { companySettings } from "@/lib/sales-data";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { ContractComment, PrintButton, SignContractForm } from "../../forms";

export const metadata: Metadata = { title: "Contract" };

export default async function PortalContract({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, contactName } = await requirePortal();
  const [{ data: c }, company, { data: comments }] = await Promise.all([
    supabase.from("contracts").select("*, type:contract_types(name)").eq("id", id).maybeSingle(),
    companySettings(supabase),
    supabase.from("contract_comments").select("id, body, from_customer, author_name, created_at").eq("contract_id", id).order("created_at"),
  ]);
  if (!c) notFound();
  const { type, ...contract } = c;
  const team = company?.company_name ?? "Our team";
  const party = await loadParty(supabase, { customer_id: c.customer_id, lead_id: null });
  return (
    <>
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link href="/portal/contracts" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> All contracts</Link>
        <PrintButton />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] print:block">
        <ContractPaper contract={contract} typeName={type?.name ?? null} company={company} party={party} />
        <aside className="space-y-6 print:hidden">
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
          <Card>
            <CardHeader title="Discussion" description="Talk to us about this contract." />
            <CardBody className="space-y-4">
              {(comments ?? []).length > 0 && (
                <ul className="space-y-3">
                  {(comments ?? []).map((m) => (
                    <li key={m.id} className={cn("rounded-xl px-3 py-2 text-sm", m.from_customer ? "bg-slate-50" : "bg-brand-50")}>
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800">{m.from_customer ? (m.author_name ?? "You") : team}</span>
                        <span className="shrink-0 text-slate-400" suppressHydrationWarning>{formatDateTime(m.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <ContractComment id={id} />
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
