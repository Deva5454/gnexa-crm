import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveExpense } from "../actions";
import { ExpenseForm } from "../expense-form";
import { expenseOptions } from "../form-data";

export const metadata: Metadata = { title: "New expense" };

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ customer?: string; project?: string }> }) {
  const { supabase } = await requireAccess("expenses", "edit", "/expenses");
  const opts = await expenseOptions(supabase);
  const sp = await searchParams;
  const pre = Number(sp.customer);
  const defaultCustomer = opts.customers.some((c) => Number(c.id) === pre) ? pre : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New expense" description="Log money spent — optionally re-bill it to a customer." />
      <ExpenseForm action={saveExpense.bind(null, null)} {...opts} defaultCustomer={defaultCustomer} defaultProject={Number(sp.project) || undefined} />
    </div>
  );
}
