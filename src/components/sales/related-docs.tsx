import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber, docStatus, KINDS, type DocKind } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";

/** Sales documents for one customer (billing tab) or one lead (proposals). */
export async function RelatedDocs({ customerId, leadId }: { customerId?: number; leadId?: number }) {
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) return null;
  let q = supabase.from("sales_docs").select("id, kind, number, subject, date, due_date, status, total, currency").order("date", { ascending: false }).limit(200);
  q = customerId ? q.eq("customer_id", customerId) : q.eq("lead_id", leadId!);
  const { data: docs } = await q;
  const bals = await balancesFor(supabase, (docs ?? []).map((d) => d.id));
  const rows = (docs ?? []).map((d) => ({
    ...d,
    bal: bals.get(d.id),
    st: docStatus({ kind: d.kind as DocKind, status: d.status, due_date: d.due_date, total: Number(d.total) }, bals.get(d.id)),
  }));
  const invoices = rows.filter((r) => r.kind === "invoice" && r.status !== "cancelled" && r.status !== "draft");
  const outstanding = invoices.reduce((s, r) => s + Math.max(0, r.bal?.balance ?? Number(r.total)), 0);
  const paid = invoices.reduce((s, r) => s + (r.bal?.paid ?? 0), 0);
  const overdue = invoices.filter((r) => r.st.key === "overdue").reduce((s, r) => s + (r.bal?.balance ?? 0), 0);
  const canEdit = can("sales", "edit");
  const query = customerId ? `customer=${customerId}` : `lead=${leadId}`;

  return (
    <div className="space-y-6">
      {customerId && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Outstanding", outstanding, "text-slate-900"],
            ["Overdue", overdue, "text-rose-600"],
            ["Paid to date", paid, "text-emerald-600"],
          ].map(([l, v, t]) => (
            <Card key={l as string} className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">{l}</div>
              <div className={`mt-1 text-xl font-bold ${t}`}>{formatMoney(v as number)}</div>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader
          title={customerId ? "Documents" : "Proposals"}
          action={
            canEdit && (
              <div className="flex gap-2">
                {customerId ? (
                  <>
                    <LinkButton href={`/sales/estimates/new?${query}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Estimate</LinkButton>
                    <LinkButton href={`/sales/invoices/new?${query}`} size="sm"><Plus className="h-3.5 w-3.5" /> Invoice</LinkButton>
                  </>
                ) : (
                  <LinkButton href={`/sales/proposals/new?${query}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Proposal</LinkButton>
                )}
              </div>
            )
          }
        />
        {!rows.length ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400"><FileText className="h-4 w-4" /> Nothing yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Document</th><th className="hidden md:table-cell">Subject</th><th>Date</th><th className="text-right">Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={docHref(d.kind as DocKind, d.id)} className="font-mono font-semibold text-brand-700 hover:underline">{docNumber(d.kind as DocKind, d.number)}</Link>
                      <div className="text-[11px] text-slate-400">{KINDS[d.kind as DocKind].label}</div>
                    </td>
                    <td className="hidden max-w-[260px] truncate text-slate-500 md:table-cell">{d.subject ?? "—"}</td>
                    <td className="whitespace-nowrap text-slate-600">{formatDate(d.date)}</td>
                    <td className="whitespace-nowrap text-right font-semibold">{formatMoney(Number(d.total), d.currency)}</td>
                    <td><Badge className={d.st.color}>{d.st.label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
