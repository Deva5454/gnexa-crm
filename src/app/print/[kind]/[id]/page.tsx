import type { Metadata } from "next";
import { pdfFields } from "@/lib/custom-fields";
import { notFound } from "next/navigation";
import { DocPaper } from "@/components/sales/doc-paper";
import { loadParty } from "@/components/sales/party";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber, docStatus, kindFromSlug } from "@/lib/sales";
import { balancesFor, companySettings, invoicePayOptions } from "@/lib/sales-data";
import { PrintToolbar } from "./print-toolbar";

export async function generateMetadata({ params }: { params: Promise<{ kind: string; id: string }> }): Promise<Metadata> {
  const p = await params;
  const kind = kindFromSlug(p.kind);
  if (!kind) return {};
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("sales_docs").select("number").eq("id", Number(p.id)).maybeSingle();
  // Browsers use the title as the default PDF file name
  return { title: { absolute: data ? docNumber(kind, data.number) : "Document" } };
}

export default async function PrintPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const p = await params;
  const kind = kindFromSlug(p.kind);
  const id = Number(p.id);
  if (!kind) notFound();
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const [{ data: doc }, { data: lines }, company, payOptions, bals, extra] = await Promise.all([
    supabase.from("sales_docs").select("*").eq("id", id).eq("kind", kind).maybeSingle(),
    supabase.from("sales_doc_items").select("*").eq("doc_id", id).order("position"),
    companySettings(supabase),
    invoicePayOptions(supabase),
    balancesFor(supabase, [id]),
    pdfFields(supabase, id),
  ]);
  if (!doc) notFound();
  const party = await loadParty(supabase, doc);
  const bal = bals.get(id);
  const status = docStatus({ kind, status: doc.status, due_date: doc.due_date, total: Number(doc.total) }, bal);

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <PrintToolbar backHref={docHref(kind, id)} name={docNumber(kind, doc.number)} />
      <div className="px-4 print:px-0">
        <DocPaper kind={kind} doc={doc} lines={lines ?? []} company={company} party={party} status={status} balance={bal} extra={extra} payOptions={payOptions} />
      </div>
    </div>
  );
}
