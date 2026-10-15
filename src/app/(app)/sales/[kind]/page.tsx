import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Plus, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { docHref, docNumber, docStatus, KINDS, kindFromSlug, STATUS_FILTERS, type DocKind } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { cn, formatDate, formatMoney, PAGE_SIZE } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const kind = kindFromSlug((await params).kind);
  return { title: kind ? KINDS[kind].plural : "Sales" };
}

type SP = { q?: string; status?: string; page?: string };

export default async function DocsPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<SP> }) {
  const kind = kindFromSlug((await params).kind);
  if (!kind) notFound();
  const sp = await searchParams;
  const k = KINDS[kind];
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  if (kind === "invoice") await supabase.rpc("run_recurring"); // raise any recurring/subscription invoices that fell due

  const { data: docs } = await supabase
    .from("sales_docs")
    .select("id, kind, number, subject, date, due_date, status, total, currency, recurring_every, recurring_from, subscription_id, customer:customers(company), lead:leads(name, company)")
    .eq("kind", kind)
    .order("date", { ascending: false })
    .order("number", { ascending: false })
    .limit(2000);
  const bals = await balancesFor(supabase, (docs ?? []).map((d) => d.id));
  const today = new Date().toISOString().slice(0, 10);

  const all = (docs ?? []).map((d) => {
    const bal = bals.get(d.id);
    return {
      ...d,
      total: Number(d.total),
      party: d.customer?.company ?? d.lead?.company ?? d.lead?.name ?? "—",
      bal,
      st: docStatus({ kind: d.kind as DocKind, status: d.status, due_date: d.due_date, total: Number(d.total) }, bal, today),
    };
  });

  // Summary tiles
  const sum = (xs: typeof all, f: (x: (typeof all)[number]) => number) => xs.reduce((s, x) => s + f(x), 0);
  const live = all.filter((d) => d.status !== "cancelled" && d.status !== "draft");
  const tiles =
    kind === "invoice"
      ? [
          { label: "Outstanding", value: formatMoney(sum(live, (d) => Math.max(0, d.bal?.balance ?? d.total))), tone: "text-slate-900" },
          { label: "Overdue", value: formatMoney(sum(all.filter((d) => d.st.key === "overdue"), (d) => d.bal?.balance ?? d.total)), tone: "text-rose-600" },
          { label: "Collected", value: formatMoney(sum(all, (d) => (d.bal?.paid ?? 0))), tone: "text-emerald-600" },
          { label: "Drafts", value: String(all.filter((d) => d.status === "draft").length), tone: "text-slate-400" },
        ]
      : kind === "credit_note"
        ? [
            { label: "Credit issued", value: formatMoney(sum(live, (d) => d.total)), tone: "text-slate-900" },
            { label: "Credit remaining", value: formatMoney(sum(live, (d) => Math.max(0, d.bal?.balance ?? d.total))), tone: "text-violet-600" },
            { label: "Open notes", value: String(all.filter((d) => d.st.key === "open").length), tone: "text-slate-900" },
            { label: "Drafts", value: String(all.filter((d) => d.status === "draft").length), tone: "text-slate-400" },
          ]
        : [
            { label: "Sent & awaiting", value: formatMoney(sum(all.filter((d) => d.st.key === "sent"), (d) => d.total)), tone: "text-sky-600" },
            { label: "Accepted", value: formatMoney(sum(all.filter((d) => d.st.key === "accepted"), (d) => d.total)), tone: "text-emerald-600" },
            { label: "Declined / expired", value: String(all.filter((d) => d.st.key === "declined" || d.st.key === "expired").length), tone: "text-rose-600" },
            { label: "Drafts", value: String(all.filter((d) => d.status === "draft").length), tone: "text-slate-400" },
          ];

  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = all.filter(
    (d) =>
      (!sp.status || d.st.key === sp.status) &&
      (!q || docNumber(kind, d.number).toLowerCase().includes(q) || d.party.toLowerCase().includes(q) || (d.subject ?? "").toLowerCase().includes(q)),
  );
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const href = (status?: string) => {
    const next = new URLSearchParams();
    if (sp.q) next.set("q", sp.q);
    if (status) next.set("status", status);
    const qs = next.toString();
    return `/sales/${k.slug}${qs ? `?${qs}` : ""}`;
  };
  const pill = (active: boolean) =>
    cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const canEdit = can("sales", "edit");

  return (
    <>
      <PageHeader
        title={k.plural}
        description={k.blurb}
        actions={
          canEdit && (
            <LinkButton href={`/sales/${k.slug}/new`}>
              <Plus className="h-4 w-4" /> New {k.label.toLowerCase()}
            </LinkButton>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{t.label}</div>
            <div className={cn("mt-1 text-xl font-bold", t.tone)}>{t.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <Link href={href()} className={pill(!sp.status)}>All</Link>
            {STATUS_FILTERS[kind].map((f) => (
              <Link key={f.key} href={href(sp.status === f.key ? undefined : f.key)} className={pill(sp.status === f.key)}>
                {f.label}
              </Link>
            ))}
          </div>
          <SearchInput placeholder={`Search ${k.plural.toLowerCase()}…`} />
        </div>

        {!rows.length ? (
          <EmptyState
            icon={FileText}
            title={all.length ? "Nothing matches" : `No ${k.plural.toLowerCase()} yet`}
            description={all.length ? "Try another filter or search." : k.blurb}
            action={!all.length && canEdit && <LinkButton href={`/sales/${k.slug}/new`}><Plus className="h-4 w-4" /> New {k.label.toLowerCase()}</LinkButton>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>{kind === "proposal" ? "To" : "Customer"}</th>
                    <th className="hidden lg:table-cell">Subject</th>
                    <th className="hidden md:table-cell">Date</th>
                    {k.dueLabel && <th className="hidden md:table-cell">{k.dueLabel}</th>}
                    <th className="text-right">Total</th>
                    {(kind === "invoice" || kind === "credit_note") && <th className="hidden text-right sm:table-cell">{kind === "invoice" ? "Balance" : "Remaining"}</th>}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link href={docHref(kind, d.id)} className="font-mono text-sm font-semibold text-brand-700 hover:underline">
                          {docNumber(kind, d.number)}
                        </Link>
                        {(d.recurring_every || d.recurring_from || d.subscription_id) && (
                          <Repeat
                            className={cn("ml-1.5 inline h-3.5 w-3.5", d.recurring_every ? "text-violet-600" : "text-slate-400")}
                            aria-label={d.recurring_every ? "Recurring template" : d.subscription_id ? "From a subscription" : "Recurring copy"}
                          />
                        )}
                      </td>
                      <td className="font-medium text-slate-800">
                        {d.party}
                        {!d.customer && d.lead && <Badge className="ml-2 bg-amber-50 text-amber-700 ring-amber-200">Lead</Badge>}
                      </td>
                      <td className="hidden max-w-[240px] truncate text-slate-500 lg:table-cell">{d.subject ?? "—"}</td>
                      <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{formatDate(d.date)}</td>
                      {k.dueLabel && (
                        <td className={cn("hidden whitespace-nowrap md:table-cell", d.st.key === "overdue" || d.st.key === "expired" ? "font-semibold text-rose-600" : "text-slate-600")}>
                          {formatDate(d.due_date)}
                        </td>
                      )}
                      <td className="whitespace-nowrap text-right font-semibold">{formatMoney(d.total, d.currency)}</td>
                      {(kind === "invoice" || kind === "credit_note") && (
                        <td className="hidden whitespace-nowrap text-right text-slate-600 sm:table-cell">
                          {d.status === "cancelled" || d.status === "draft" ? "—" : formatMoney(Math.max(0, d.bal?.balance ?? d.total), d.currency)}
                        </td>
                      )}
                      <td><Badge className={d.st.color}>{d.st.label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} basePath={`/sales/${k.slug}`} params={{ q: sp.q, status: sp.status }} />
          </>
        )}
      </Card>
    </>
  );
}
