import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveContract } from "../actions";
import { ContractForm } from "../contract-form";
import { contractFormOptions } from "../form-data";

export const metadata: Metadata = { title: "New contract" };

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ customer?: string; project?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAccess("contracts", "edit", "/contracts");
  const opts = await contractFormOptions(supabase);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New contract" description="Starts as a draft. Send it, then record the signature." />
      <ContractForm action={saveContract.bind(null, null)} {...opts} defaultCustomer={Number(sp.customer) || undefined} defaultProject={Number(sp.project) || undefined} cancelHref="/contracts" />
    </div>
  );
}
