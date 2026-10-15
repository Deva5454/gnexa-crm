import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const { supabase } = await requireStaff();
  const { data: groups } = await supabase.from("customer_groups").select("*").order("name");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New customer" description="Add a company you do business with." />
      <CustomerForm action={createCustomer} groups={groups ?? []} cancelHref="/customers" />
    </div>
  );
}
