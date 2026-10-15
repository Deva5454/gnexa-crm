import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveExpense } from "../actions";
import { ExpenseForm } from "../expense-form";
import { expenseOptions } from "../form-data";

export const metadata: Metadata = { title: "New expense" };

export default async function NewExpensePage() {
  const { supabase } = await requireAccess("expenses", "edit", "/expenses");
  const opts = await expenseOptions(supabase);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New expense" description="Log money spent — optionally re-bill it to a customer." />
      <ExpenseForm action={saveExpense.bind(null, null)} {...opts} />
    </div>
  );
}
