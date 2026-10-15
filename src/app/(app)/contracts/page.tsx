import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { contractNumber, contractState } from "@/lib/constants";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Contracts" };

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
  { key: "sent", label: "Awaiting signature" },
  { key: "draft", label: "Draft" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string }> }) {
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("contracts", "view")) notFound();
  const { data } = await supabase
    .from("contracts")
    .select("id, subject, value, start_date, end_date, status, signed_by, customer:customers(id, company), type:contract_types(name)")
    .order("end_date", { ascending: true, nullsFirst: false });
  const all = (data ?? []).map((c) => ({ ...c, st: contractState(c) }));
  const q = (sp.q ?? "").toLowerCase();
  const rows = all.filter(
    (c) =>
      (!sp.state || c.st.key === sp.state || (sp.state === "active" && c.st.key === "upcoming")) &&
      (!q || c.subject.toLowerCase().includes(q) || (c.customer?.company ?? "").toLowerCase().includes(q) || contractNumber(c.id).toLowerCase().includes(q)),
  );
  const live = all.filter((c) => ["active", "expiring", "upcoming"].includes(c.st.key));
  const tiles = [
    { label: "Active contracts", value: String(live.length), tone: "text-emerald-600" },
    { label: "Active value", value: formatMoney(live.reduce((s, c) => s + Number(c.value ?? 0), 0)), tone: "text-slate-900" },
    { label: "Expiring in 30 days", value: String(all.filter((c) => c.st.key === "expiring").length), tone: "text-amber-600" },
    { label: "Awaiting signature", value: String(all.filter((c) => c.st.key === "sent").length), tone: "text-sky-600" },
  ];
  const href = (state?: string) => {
    const n = new URLSearchParams();
    if (sp.q) n.set("q", sp.q);
    if (state) n.set("state", state);
    const s = n.toString();
    return s ? `/contracts?${s}` : "/contracts";
  };
  const pill = (a: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", a ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader
        title="Contracts"
        description="Agreements with customers — terms, value, signatures and renewals."
        actions={can("contracts", "edit") && <LinkButton href="/contracts/new"><Plus className="h-4 w-4" /> New contract</LinkButton>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="px-5 py-4"><div className="text-xs font-medium text-slate-500">{t.label}</div><div className={cn("mt-1 text-xl font-bold", t.tone)}>{t.value}</div></Card>
        ))}
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href()} className={pill(!sp.state)}>All</Link>
            {FILTERS.map((f) => <Link key={f.key} href={href(sp.state === f.key ? undefined : f.key)} className={pill(sp.state === f.key)}>{f.label}</Link>)}
          </div>
          <SearchInput placeholder="Search contracts…" />
        </div>
        {!rows.length ? (
          <EmptyState icon={FileSignature} title="No contracts here" description="Draft an agreement for a customer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Contract</th><th>Customer</th><th className="hidden lg:table-cell">Type</th><th className="hidden md:table-cell">Term</th><th className="text-right">Value</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contracts/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{c.subject}</Link>
                      <div className="font-mono text-[11px] text-slate-400">{contractNumber(c.id)}</div>
                    </td>
                    <td className="text-slate-700">{c.customer?.company}</td>
                    <td className="hidden text-slate-600 lg:table-cell">{c.type?.name ?? "—"}</td>
                    <td className={cn("hidden whitespace-nowrap md:table-cell", c.st.key === "expiring" ? "font-semibold text-amber-600" : c.st.key === "expired" ? "text-rose-600" : "text-slate-600")}>
                      {formatDate(c.start_date)} → {formatDate(c.end_date)}
                    </td>
                    <td className="whitespace-nowrap text-right font-semibold">{c.value != null ? formatMoney(Number(c.value)) : "—"}</td>
                    <td><Badge className={c.st.color}>{c.st.label}</Badge></td>
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
