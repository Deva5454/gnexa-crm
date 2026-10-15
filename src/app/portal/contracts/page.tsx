import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePortal } from "@/lib/auth";
import { contractNumber, contractState } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Contracts" };

export default async function PortalContracts() {
  const { supabase } = await requirePortal();
  const { data } = await supabase.from("contracts").select("id, subject, value, start_date, end_date, status, type:contract_types(name)").order("start_date", { ascending: false });
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Contracts</h1>
      {!data?.length ? <Card><EmptyState icon={FileSignature} title="No contracts yet" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => {
            const st = contractState(c);
            return (
              <Link key={c.id} href={`/portal/contracts/${c.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 group-hover:text-brand-700">{c.subject}</div>
                      <div className="text-xs text-slate-500">{c.type?.name ?? "Agreement"} · <span className="font-mono">{contractNumber(c.id)}</span></div>
                    </div>
                    <Badge className={st.color}>{st.key === "sent" ? "Please sign" : st.label}</Badge>
                  </div>
                  <div className="mt-4 flex justify-between text-sm text-slate-600">
                    <span>{formatDate(c.start_date)} → {formatDate(c.end_date)}</span>
                    {c.value != null && <b>{formatMoney(Number(c.value))}</b>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
