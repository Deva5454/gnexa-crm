import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Contract settings" };

export default async function ContractSettingsPage() {
  const { supabase } = await requireAdmin();
  const { data: types } = await supabase.from("contract_types").select("id, name").order("name");
  return <NamedList table="contract_types" title="Contract types" description="AMC, licence, NDA, SOW…" items={types ?? []} />;
}
