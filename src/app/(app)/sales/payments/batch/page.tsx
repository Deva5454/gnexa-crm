import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { todayIST } from "@/lib/dates";
import { allRows } from "@/lib/fetch-all";
import { docHref, docNumber } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { formatDate } from "@/lib/utils";
import { BatchForm, type OpenInvoice } from "./batch-form";

export const metadata: Metadata = { title: "Batch payments" };

export default async function BatchPaymentsPage() {
  const { supabase } = await requireAccess("sales", "edit", "/sales/payments");
  const today = todayIST();
  const [{ data: invs }, { data: modes }] = await Promise.all([
    allRows((a, b) =>
      supabase.from("sales_docs").select("id, number, due_date, currency, total, customer:customers(company)").eq("kind", "invoice").eq("status", "sent").order("due_date").order("id").range(a, b),
    ),
    supabase.from("payment_modes").select("id, name").eq("is_active", true).order("id"),
  ]);
  const bals = await balancesFor(supabase, invs.map((i) => i.id));
  const open: OpenInvoice[] = invs
    .map((i) => ({ i, balance: bals.get(i.id)?.balance ?? Number(i.total) }))
    .filter((x) => x.balance > 0.005)
    .map(({ i, balance }) => ({
      id: i.id,
      label: docNumber("invoice", i.number),
      href: docHref("invoice", i.id),
      customer: i.customer?.company ?? "—",
      due: i.due_date ? formatDate(i.due_date) : null,
      overdue: !!i.due_date && i.due_date < today,
      balance,
      currency: i.currency,
    }))
    .sort((a, b) => a.customer.localeCompare(b.customer))
    .slice(0, 300);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/sales/payments" className="hover:text-brand-600">Payments</Link>}
        title="Batch payments"
        description="Record money received against several invoices at once — e.g. from a bank statement."
      />
      <Card>
        {!open.length ? (
          <EmptyState icon={Wallet} title="Nothing to collect" description="Every sent invoice is fully paid." />
        ) : (
          <CardBody>
            <BatchForm invoices={open} modes={modes ?? []} today={today} />
          </CardBody>
        )}
      </Card>
    </>
  );
}
