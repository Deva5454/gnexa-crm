import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Download, FileCode2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { monthStartIST, todayIST } from "@/lib/dates";
import { checkDoc, loadEInvoiceDocs } from "@/lib/einvoice";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "e-Invoice export" };

const iso = (v: string | undefined, fb: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fb);
const KIND = { b2b: "B2B", export: "Export", b2c: "B2C" } as const;

export default async function EInvoicePage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const from = iso(sp.from, monthStartIST());
  const to = iso(sp.to, todayIST());
  const { docs, company } = await loadEInvoiceDocs(supabase, from, to);
  const checks = docs.map((d) => checkDoc(d, company));
  const ready = checks.filter((c) => c.kind !== "b2c" && !c.issues.length).length;

  return (
    <>
      <PageHeader
        title="e-Invoice export"
        description="GST e-invoice JSON (IRP schema 1.1) for your B2B and export invoices and credit notes — upload it to the e-invoice portal to get IRNs."
      />
      <Card className="mb-6">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="label">From</span>
              <input type="date" name="from" defaultValue={from} className="field" />
            </label>
            <label className="text-sm">
              <span className="label">To</span>
              <input type="date" name="to" defaultValue={to} className="field" />
            </label>
            <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Check documents</button>
            <a
              href={`/einvoice/download?from=${from}&to=${to}`}
              className={`ml-auto inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white ${ready ? "bg-brand-600 hover:bg-brand-700" : "pointer-events-none bg-slate-300"}`}
              aria-disabled={!ready}
            >
              <Download className="h-4 w-4" /> Download {ready} e-invoice{ready === 1 ? "" : "s"}
            </a>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`${checks.length} document${checks.length === 1 ? "" : "s"}`} description="B2C documents (customer without a GSTIN) don't need an IRN and are left out." />
        {!checks.length ? (
          <EmptyState icon={FileCode2} title="No invoices or credit notes" description="Nothing was issued in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Document</th><th>Customer</th><th>Type</th><th className="text-right">Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-sm">{c.label}</td>
                    <td>{c.customer}</td>
                    <td><Badge className="bg-slate-100 text-slate-600 ring-slate-200">{KIND[c.kind]}</Badge></td>
                    <td className="text-right">{formatMoney(c.total)}</td>
                    <td className="text-sm">
                      {c.kind === "b2c" ? (
                        <span className="text-slate-400">Not needed</span>
                      ) : c.issues.length ? (
                        <span className="flex items-start gap-1.5 text-amber-700"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{c.issues.join(" · ")}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
