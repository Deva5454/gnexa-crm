import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Contracts & support settings" };

export default async function DeliverySettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: types }, { data: depts }, { data: groups }] = await Promise.all([
    supabase.from("contract_types").select("id, name").order("name"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("kb_groups").select("id, name").order("position"),
  ]);
  return (
    <>
      <NamedList table="contract_types" title="Contract types" description="AMC, licence, NDA, SOW…" items={types ?? []} />
      <NamedList table="ticket_departments" title="Support departments" description="Route tickets to the right team." items={depts ?? []} />
      <NamedList table="kb_groups" title="Knowledge base categories" items={groups ?? []} />
    </>
  );
}
