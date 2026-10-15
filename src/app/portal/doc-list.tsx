import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePortal } from "@/lib/auth";
import { docNumber, docStatus, KINDS, type DocKind } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";

export async function PortalDocList({ kinds, base }: { kinds: DocKind[]; base: string }) {
  const { supabase } = await requirePortal();
  const { data } = await supabase.from("sales_docs").select("id, kind, number, subject, date, due_date, status, total, currency").in("kind", kinds).order("date", { ascending: false });
  const bals = await balancesFor(supabase, (data ?? []).map((d) => d.id));
  if (!data?.length) return <Card><EmptyState icon={FileText} title="Nothing here yet" /></Card>;
  const showBalance = kinds.includes("invoice");
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Number</th><th className="hidden md:table-cell">Subject</th><th>Date</th><th className="hidden sm:table-cell">{showBalance ? "Due" : "Valid until"}</th><th className="text-right">Total</th>{showBalance && <th className="text-right">Balance</th>}<th>Status</th></tr></thead>
          <tbody>
            {data.map((d) => {
              const kind = d.kind as DocKind;
              const st = docStatus({ kind, status: d.status, due_date: d.due_date, total: Number(d.total) }, bals.get(d.id));
              return (
                <tr key={d.id}>
                  <td>
                    <Link href={`${base}/${d.id}`} className="font-mono font-semibold text-brand-700 hover:underline">{docNumber(kind, d.number)}</Link>
                    {kinds.length > 1 && <div className="text-[11px] text-slate-400">{KINDS[kind].label}</div>}
                  </td>
                  <td className="hidden max-w-[260px] truncate text-slate-600 md:table-cell">{d.subject ?? "—"}</td>
                  <td className="whitespace-nowrap text-slate-600">{formatDate(d.date)}</td>
                  <td className="hidden whitespace-nowrap text-slate-600 sm:table-cell">{formatDate(d.due_date)}</td>
                  <td className="whitespace-nowrap text-right font-semibold">{formatMoney(Number(d.total), d.currency)}</td>
                  {showBalance && <td className="whitespace-nowrap text-right">{d.status === "cancelled" ? "—" : formatMoney(Math.max(0, bals.get(d.id)?.balance ?? 0), d.currency)}</td>}
                  <td><Badge className={st.color}>{st.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
