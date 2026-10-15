import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Customer groups" };

export default async function CustomerGroupsPage() {
  const { supabase } = await requireAdmin();
  const { data: groups } = await supabase.from("customer_groups").select("id, name").order("name");
  return <NamedList table="customer_groups" title="Customer groups" description="Segment customers, e.g. VIP, Wholesale, Retail." items={groups ?? []} />;
}
