import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const { supabase } = await requireAccess("customers", "edit", "/customers");
  const [{ data: groups }, { data: currencies }, { data: settings }] = await Promise.all([
    supabase.from("customer_groups").select("*").order("name"),
    supabase.from("currencies").select("code").order("is_base", { ascending: false }).order("code"),
    supabase.from("company_settings").select("default_country").maybeSingle(),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New customer" description="Add a company you do business with." />
      <CustomerForm action={createCustomer} groups={groups ?? []} currencies={(currencies ?? []).map((c) => c.code)} cancelHref="/customers" defaultCountry={settings?.default_country ?? ""} />
    </div>
  );
}
