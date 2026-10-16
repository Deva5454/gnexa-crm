import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { ItemForm } from "./item-form";
import { ItemsTable } from "./items-table";

export const metadata: Metadata = { title: "Items" };

export default async function ItemsPage() {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const [{ data: items }, { data: taxes }] = await Promise.all([
    supabase.from("items").select("id, name, description, rate, unit, tax_id, hsn_sac, tax:taxes(name)").order("name"),
    supabase.from("taxes").select("id, name").order("rate"),
  ]);
  const canEdit = can("sales", "edit");
  return (
    <>
      <PageHeader title="Items" description="Products and services you sell — pick them when building proposals, estimates and invoices." />
      {canEdit && (
        <Card className="mb-6">
          <CardHeader title="Add an item" />
          <CardBody><ItemForm taxes={taxes ?? []} /></CardBody>
        </Card>
      )}
      <Card>
        {!items?.length ? (
          <EmptyState icon={Package} title="No items yet" description="Add the products and services you sell most often." />
        ) : (
          <ItemsTable
            items={items.map((i) => ({ id: i.id, name: i.name, description: i.description, rate: Number(i.rate), unit: i.unit, tax_id: i.tax_id, hsn_sac: i.hsn_sac, tax_name: i.tax?.name ?? null }))}
            taxes={taxes ?? []}
            canEdit={canEdit}
            canDelete={can("sales", "full")}
          />
        )}
      </Card>
    </>
  );
}
