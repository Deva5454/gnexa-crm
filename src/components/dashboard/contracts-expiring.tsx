import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { contractNumber, contractState } from "@/lib/constants";
import { daysFromToday, todayIST } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/utils";

/** Perfex "Contracts expiring soon": signed contracts ending in the next 30 days, plus any lapsed in the last 30. */
export async function ContractsExpiring({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  if (!can("contracts", "view")) return null;
  const today = todayIST();
  const { data } = await supabase
    .from("contracts")
    .select("id, subject, value, status, start_date, end_date, customer:customers(company)")
    .eq("status", "signed")
    .gte("end_date", daysFromToday(-30))
    .lte("end_date", daysFromToday(30))
    .order("end_date")
    .limit(10);
  const rows = data ?? [];
  return (
    <Card className={className}>
      <CardHeader
        title="Contracts expiring soon"
        description="Signed contracts ending within 30 days, and any that ended in the last 30"
        action={<Link href="/contracts?state=expiring" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Contracts →</Link>}
      />
      {!rows.length ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No contracts ending soon.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5">Contract</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5 text-right">Value</th>
                <th className="px-3 py-2.5">Ends</th>
                <th className="px-5 py-2.5">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const st = contractState(c, today);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="max-w-[220px] px-5 py-2.5">
                      <Link href={`/contracts/${c.id}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                        <span className="text-slate-400">{contractNumber(c.id)}</span> {c.subject}
                      </Link>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-slate-600">{c.customer?.company}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-700">{c.value != null ? formatMoney(Number(c.value)) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(c.end_date)}</td>
                    <td className="px-5 py-2.5"><Badge className={st.color}>{st.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
