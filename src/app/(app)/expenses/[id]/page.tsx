import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Download, FilePlus2, FileText, Paperclip, Repeat, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAccess } from "@/lib/auth";
import { docHref, docNumber, INTERVAL_LABEL } from "@/lib/sales";
import { formatDate, formatMoney } from "@/lib/utils";
import { ReceiptUploader } from "./receipt";
import { copyExpense, deleteExpense, invoiceExpense, removeReceipt, saveExpense } from "../actions";
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
  const [{ data: copies }, { data: template }] = await Promise.all([
    e.recurring_every ? supabase.from("expenses").select("id, date, amount").eq("recurring_from", id).order("date", { ascending: false }).limit(12) : Promise.resolve({ data: null }),
    e.recurring_from ? supabase.from("expenses").select("id, name, date").eq("id", e.recurring_from).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const canEdit = can("expenses", "edit");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<Link href="/expenses" className="hover:text-brand-600">Expenses</Link>}
        title={e.name}
        actions={
          <>
            {!invoice && e.is_billable && e.customer_id && can("expenses", "edit") && can("sales", "edit") && (
              <>
                <LinkButton href={`/sales/invoices/new?customer=${e.customer_id}&expense=${id}`} variant="accent" size="sm"><FilePlus2 className="h-3.5 w-3.5" /> Add to new invoice</LinkButton>
                <form action={invoiceExpense}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="secondary" size="sm" pendingText="Creating…"><FileText className="h-3.5 w-3.5" /> Bill on its own</SubmitButton>
                </form>
              </>
            )}
            {can("expenses", "edit") && (
              <form action={copyExpense}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="secondary" size="sm" pendingText="Copying…"><Copy className="h-3.5 w-3.5" /> Copy</SubmitButton>
              </form>
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
      {(e.recurring_every || template) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm text-violet-900">
          <Repeat className="h-4 w-4 text-violet-600" />
          {e.recurring_every ? (
            <span>
              <b>Repeats every {INTERVAL_LABEL(e.recurring_every, e.recurring_unit)}</b> · {e.recurring_done} cop{e.recurring_done === 1 ? "y" : "ies"} made
              {e.recurring_cycles ? ` of ${e.recurring_cycles}` : ""} · {e.next_recurring_date ? `next on ${formatDate(e.next_recurring_date)}` : "finished"}
              {(copies?.length ?? 0) > 0 && (
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {copies!.map((c) => (
                    <Link key={c.id} href={`/expenses/${c.id}`} className="rounded-full bg-white px-2 py-0.5 text-xs text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100">
                      {formatDate(c.date)} · {formatMoney(Number(c.amount))}
                    </Link>
                  ))}
                </span>
              )}
            </span>
          ) : (
            <span>Created automatically from <Link href={`/expenses/${template!.id}`} className="font-semibold underline">{template!.name} ({formatDate(template!.date)})</Link></span>
          )}
        </div>
      )}
      <div
        className={`mb-6 flex flex-wrap items-center gap-2 rounded-2xl border px-5 py-3 text-sm ${
          invoice ? "border-emerald-200 bg-emerald-50 text-emerald-900" : e.is_billable && e.customer_id ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-600"
        }`}
      >
        <b>Billing:</b>
        {invoice ? (
          <span>Billed to the customer on <Link href={docHref("invoice", invoice.id)} className="font-semibold underline">{docNumber("invoice", invoice.number)}</Link>. Remove the line from that invoice (or cancel it) to make this pending again.</span>
        ) : e.is_billable && e.customer_id ? (
          <span>Pending billing — it&apos;s offered automatically when you create an invoice for this customer.</span>
        ) : e.customer_id ? (
          <span>Not billable — linked to a customer for tracking only. Tick &ldquo;Billable to the customer&rdquo; below to re-bill it.</span>
        ) : (
          <span>Internal expense — not billable.</span>
        )}
      </div>
      <Card className="mb-6">
        <CardHeader title="Receipt" />
        <CardBody className="space-y-3">
          {e.receipt_path && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
              <Paperclip className="h-4 w-4 text-slate-400" />
              <a href={`/expenses/receipt/${id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700">{e.receipt_name ?? "Receipt"}</a>
              <a href={`/expenses/receipt/${id}`} className="rounded p-1 text-slate-400 hover:text-brand-700" aria-label="Download receipt"><Download className="h-4 w-4" /></a>
              {canEdit && (
                <ConfirmForm action={removeReceipt} message="Remove this receipt?">
                  <input type="hidden" name="id" value={id} />
                  <button className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label="Remove receipt"><Trash2 className="h-4 w-4" /></button>
                </ConfirmForm>
              )}
            </div>
          )}
          {canEdit ? <ReceiptUploader expenseId={id} replace={!!e.receipt_path} /> : !e.receipt_path && <p className="text-sm text-slate-400">No receipt attached.</p>}
        </CardBody>
      </Card>
      <ExpenseForm action={saveExpense.bind(null, id)} expense={expense} {...opts} />
    </div>
  );
}
