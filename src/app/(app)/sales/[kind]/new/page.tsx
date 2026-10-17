import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { addDays, expenseLine, KINDS, kindFromSlug } from "@/lib/sales";
import { saveDoc } from "../../actions";
import { DocEditor } from "../doc-editor";
import { editorOptions } from "../editor-data";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "New document" };

export default async function NewDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ customer?: string; lead?: string; expense?: string }>;
}) {
  const kind = kindFromSlug((await params).kind);
  if (!kind) notFound();
  const sp = await searchParams;
  const k = KINDS[kind];
  const { supabase, profile } = await requireAccess("sales", "edit", `/sales/${k.slug}`);
  const opts = await editorOptions(supabase);
  const today = todayIST();
  const party = sp.customer ? `customer:${Number(sp.customer)}` : sp.lead && kind === "proposal" ? `lead:${Number(sp.lead)}` : "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`New ${k.label.toLowerCase()}`} description={k.blurb} />
      <DocEditor
        kind={kind}
        action={saveDoc.bind(null, kind, null)}
        isNew
        cancelHref={`/sales/${k.slug}`}
        customers={opts.customers}
        leads={opts.leads}
        catalogue={opts.catalogue}
        taxRates={opts.taxRates}
        currencies={opts.currencies}
        billableExpenses={kind === "invoice" ? opts.billableExpenses : []}
        staff={opts.staff}
        templates={kind === "proposal" ? opts.templates : []}
        draft={{
          party,
          subject: "",
          content: "",
          date: today,
          due_date: k.dueLabel ? addDays(today, kind === "invoice" ? opts.defaults.invoiceDueDays : opts.defaults.quoteValidDays) : "",
          currency: opts.customers.find((c) => c.value === party)?.currency || opts.currency,
          discount_percent: 0,
          adjustment: 0,
          sale_agent: profile.id, // Perfex defaults the sale agent to whoever creates it
          notes: kind === "invoice" ? opts.defaults.invoiceNote : "",
          terms: kind === "invoice" ? opts.defaultTerms : kind === "estimate" ? opts.defaults.estimateTerms : kind === "proposal" ? opts.defaults.proposalTerms : "",
          // "Add to an invoice" from an expense pre-fills that expense as the first line
          lines: kind === "invoice" && sp.expense
            ? opts.billableExpenses.filter((e) => e.id === Number(sp.expense) && `customer:${e.customer_id}` === party).map(expenseLine)
            : [],
        }}
      />
    </div>
  );
}
