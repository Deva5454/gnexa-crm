import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { KINDS } from "@/lib/sales";
import { defaultRange } from "@/lib/statement";

export const metadata: Metadata = { title: "Bulk PDF export" };

export default async function BulkPdfPage() {
  const { can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const r = defaultRange();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Bulk PDF export" description="Print many documents in one go — for your accountant, an audit or the month-end file." />
      <Card>
        <CardHeader title="What to export" description="Opens a print view with one document per page. Choose “Save as PDF” as the printer. Up to 100 documents at a time." />
        <CardBody>
          <form action="/print/bulk" target="_blank" className="grid gap-4 sm:grid-cols-2">
            <Field label="Documents" htmlFor="kind">
              <select id="kind" name="kind" className="field">
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.plural}</option>)}
              </select>
            </Field>
            <Field label="Status" htmlFor="status">
              <select id="status" name="status" className="field">
                <option value="">All except drafts</option>
                <option value="draft">Drafts only</option>
                <option value="sent">Sent / open</option>
                <option value="accepted">Accepted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="From" htmlFor="from"><input id="from" name="from" type="date" defaultValue={r.from} className="field" /></Field>
            <Field label="To" htmlFor="to"><input id="to" name="to" type="date" defaultValue={r.to} className="field" /></Field>
            <div className="sm:col-span-2">
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
                <FileDown className="h-4 w-4" /> Open print view
              </button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
