import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { docHref, docNumber, KINDS, kindFromSlug } from "@/lib/sales";
import { saveDoc } from "../../../actions";
import { DocEditor } from "../../doc-editor";
import { editorOptions } from "../../editor-data";

export const metadata: Metadata = { title: "Edit document" };

export default async function EditDocPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const p = await params;
  const kind = kindFromSlug(p.kind);
  const id = Number(p.id);
  if (!kind) notFound();
  const { supabase } = await requireAccess("sales", "edit", docHref(kind, id));
  const [{ data: doc }, { data: lines }, opts] = await Promise.all([
    supabase.from("sales_docs").select("*").eq("id", id).eq("kind", kind).maybeSingle(),
    supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position"),
    editorOptions(supabase),
  ]);
  if (!doc) notFound();
  const party = doc.customer_id ? `customer:${doc.customer_id}` : `lead:${doc.lead_id}`;
  // Keep the current party selectable even if it's now a converted lead
  if (doc.lead_id && !doc.customer_id && !opts.leads.some((l) => l.value === party)) {
    const { data: l } = await supabase.from("leads").select("name, company").eq("id", doc.lead_id).maybeSingle();
    opts.leads.unshift({ value: party, label: l ? (l.company ? `${l.name} · ${l.company}` : l.name) : `Lead #${doc.lead_id}` });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${docNumber(kind, doc.number)}`} description={KINDS[kind].label} />
      <DocEditor
        kind={kind}
        action={saveDoc.bind(null, kind, id)}
        isNew={false}
        cancelHref={docHref(kind, id)}
        customers={opts.customers}
        leads={opts.leads}
        catalogue={opts.catalogue}
        taxRates={opts.taxRates}
        currencies={opts.currencies}
        draft={{
          party,
          subject: doc.subject ?? "",
          content: doc.content ?? "",
          date: doc.date,
          due_date: doc.due_date ?? "",
          currency: doc.currency,
          discount_percent: Number(doc.discount_percent),
          adjustment: Number(doc.adjustment),
          notes: doc.notes ?? "",
          terms: doc.terms ?? "",
          recurring_every: doc.recurring_every,
          recurring_unit: doc.recurring_unit,
          recurring_cycles: doc.recurring_cycles,
          lines: (lines ?? []).map((l) => ({
            item_id: l.item_id,
            description: l.description,
            long_description: l.long_description,
            qty: Number(l.qty),
            unit: l.unit,
            rate: Number(l.rate),
            tax_rate: Number(l.tax_rate),
          })),
        }}
      />
    </div>
  );
}
