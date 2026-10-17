import type { Metadata } from "next";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { RelatedTasks } from "@/components/crm/related-tasks";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Pencil, Printer, RefreshCcw, RotateCcw, Send, Trash2 } from "lucide-react";
import { ContractPaper } from "@/components/sales/contract-paper";
import { loadParty } from "@/components/sales/party";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { contractNumber, contractState } from "@/lib/constants";
import { companySettings } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";
import { deleteContract, renewContract, setContractStatus } from "../actions";
import { SignForm } from "./sign-form";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "Contract" };

function StatusBtn({ id, status, label, icon: Icon }: { id: number; status: string; label: string; icon: typeof Send }) {
  return (
    <form action={setContractStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={status === "sent" ? "primary" : "secondary"} size="sm"><Icon className="h-3.5 w-3.5" /> {label}</SubmitButton>
    </form>
  );
}

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
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
  const st = contractState(c);
  const canEdit = can("contracts", "edit");
  const today = todayIST();
  const daysLeft = c.end_date ? Math.round((new Date(c.end_date).getTime() - new Date(today).getTime()) / 86400_000) : null;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/contracts" className="hover:text-brand-600">Contracts</Link>}
        title={<span className="flex flex-wrap items-center gap-3"><span className="font-mono">{contractNumber(id)}</span><Badge className={st.color}>{st.label}</Badge></span>}
        description={party.href ? <Link href={party.href} className="hover:text-brand-600">{party.name} · {c.subject}</Link> : c.subject}
        actions={
          <>
            <a href={`/print/contracts/${id}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}><Printer className="h-3.5 w-3.5" /> PDF / Print</a>
            {canEdit && c.status !== "cancelled" && <LinkButton href={`/contracts/${id}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
            {canEdit && c.status === "draft" && <StatusBtn id={id} status="sent" label="Send for signature" icon={Send} />}
            {canEdit && (st.key === "expiring" || st.key === "expired") && (
              <form action={renewContract}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="accent" size="sm" pendingText="Creating…"><RefreshCcw className="h-3.5 w-3.5" /> Renew</SubmitButton>
              </form>
            )}
            {canEdit && c.status !== "cancelled" && c.status !== "draft" && <StatusBtn id={id} status="cancelled" label="Cancel" icon={Ban} />}
            {canEdit && (c.status === "cancelled" || c.status === "sent") && <StatusBtn id={id} status="draft" label="Back to draft" icon={RotateCcw} />}
            {can("contracts", "full") && (
              <ConfirmForm action={deleteContract} message={`Delete contract ${contractNumber(id)}?`}>
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete contract"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <ContractPaper contract={contract} typeName={type?.name ?? null} company={company} party={party} />
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span>{type?.name ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Value</span><b>{c.value != null ? formatMoney(Number(c.value)) : "—"}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Term</span><span>{formatDate(c.start_date)} → {formatDate(c.end_date)}</span></div>
              {daysLeft != null && c.status === "signed" && (
                <div className="flex justify-between"><span className="text-slate-500">{daysLeft >= 0 ? "Ends in" : "Ended"}</span><span className={daysLeft < 30 ? "font-semibold text-amber-600" : ""}>{Math.abs(daysLeft)} days{daysLeft < 0 ? " ago" : ""}</span></div>
              )}
              {c.signed_by && <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-500">Signed by</span><span className="font-medium">{c.signed_by}</span></div>}
              {c.signed_at && <div className="flex justify-between"><span className="text-slate-500">Signed on</span><span>{formatDate(c.signed_at)}</span></div>}
            </CardBody>
          </Card>
          {canEdit && c.status === "sent" && (
            <Card>
              <CardHeader title="Record signature" description="Once you have the signed copy back." />
              <CardBody><SignForm id={id} defaultSigner={party.contact ?? ""} /></CardBody>
            </Card>
          )}
          <CustomFieldsCard entity="contract" relId={id} path={`/contracts/${id}`} />
          <RemindersPanel relType="contract" relId={id} path={`/contracts/${id}`} />
          <RelatedTasks relType="contract" relId={id} compact />
        </aside>
      </div>
    </>
  );
}
