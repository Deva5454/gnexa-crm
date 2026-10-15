import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { updateCustomer } from "../../actions";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requireAccess("customers", "edit", `/customers/${id}`);
  const [{ data: customer }, { data: groups }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("customer_groups").select("*").order("name"),
  ]);
  if (!customer) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${customer.company}`} />
      <CustomerForm action={updateCustomer.bind(null, id)} customer={customer} groups={groups ?? []} cancelHref={`/customers/${id}`} />
    </div>
  );
}
