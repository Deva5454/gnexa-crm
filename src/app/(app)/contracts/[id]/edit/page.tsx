import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { contractNumber } from "@/lib/constants";
import { saveContract } from "../../actions";
import { ContractForm } from "../../contract-form";
import { contractFormOptions } from "../../form-data";

export const metadata: Metadata = { title: "Edit contract" };

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requireAccess("contracts", "edit", `/contracts/${id}`);
  const [{ data: c }, opts] = await Promise.all([supabase.from("contracts").select("*").eq("id", id).maybeSingle(), contractFormOptions(supabase)]);
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${contractNumber(id)}`} description={c.status === "signed" ? "This contract is signed — changes won't alter the signed copy." : undefined} />
      <ContractForm action={saveContract.bind(null, id)} contract={c} {...opts} cancelHref={`/contracts/${id}`} />
    </div>
  );
}
