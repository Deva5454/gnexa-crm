import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAccess } from "@/lib/auth";
import { docHref, docNumber } from "@/lib/sales";
import { deleteExpense, invoiceExpense, saveExpense } from "../actions";
import { ExpenseForm } from "../expense-form";
import { expenseOptions } from "../form-data";

export const metadata: Metadata = { title: "Expense" };

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireAccess("expenses", "view", "/dashboard");
  const [{ data: e }, opts] = await Promise.all([
    supabase.from("expenses").select("*, invoice:sales_docs(id, number)").eq("id", id).maybeSingle(),
    expenseOptions(supabase),
  ]);
  if (!e) notFound();
  const { invoice, ...expense } = e;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<Link href="/expenses" className="hover:text-brand-600">Expenses</Link>}
        title={e.name}
        actions={
          <>
            {invoice ? (
              <Link href={docHref("invoice", invoice.id)} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Billed on {docNumber("invoice", invoice.number)}
              </Link>
            ) : (
              e.is_billable &&
              e.customer_id &&
              can("expenses", "edit") &&
              can("sales", "edit") && (
                <form action={invoiceExpense}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="accent" size="sm" pendingText="Creating…"><FileText className="h-3.5 w-3.5" /> Bill to customer</SubmitButton>
                </form>
              )
            )}
            {can("expenses", "full") && (
              <ConfirmForm action={deleteExpense} message={`Delete expense “${e.name}”?`}>
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
              </ConfirmForm>
            )}
          </>
        }
      />
      <ExpenseForm action={saveExpense.bind(null, id)} expense={expense} {...opts} />
    </div>
  );
}
