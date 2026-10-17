import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Module } from "@/lib/permissions";
import { docNumber, docStatus, receiptNumber } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { allRows } from "@/lib/fetch-all";
import { daysFromToday, periodRange, todayIST } from "@/lib/dates";
import { toBase } from "@/lib/sales-data";

type DB = SupabaseClient<Database>;

/** One report table: drives the chart, the visible table and the CSV export. */
export type ReportTable = {
  key: string;
  title: string;
  description?: string;
  columns: { label: string; money?: boolean; numeric?: boolean }[];
  rows: (string | number)[][];
};

export const REPORT_TABS: { key: string; label: string; module: Module }[] = [
  { key: "sales", label: "Sales", module: "sales" },
  { key: "detail", label: "Invoices & payments", module: "sales" },
  { key: "leads", label: "Leads", module: "leads" },
  { key: "expenses", label: "Expenses", module: "expenses" },
  { key: "income", label: "Expenses vs income", module: "expenses" },
  { key: "time", label: "Timesheets overview", module: "projects" },
  { key: "kb", label: "KB articles", module: "knowledge_base" },
  { key: "support", label: "Support", module: "support" },
];

/** Last n months as [{ key: "2026-10", label: "Oct" }] oldest first. */
export function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({
      key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
      label: m.toLocaleDateString("en-IN", { month: "short", year: i >= 12 ? "2-digit" : undefined }),
    });
  }
  return out;
}
const monthOf = (iso: string) => iso.slice(0, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function salesReports(supabase: DB): Promise<ReportTable[]> {
  const months = lastMonths(6);
  const since = `${months[0]!.key}-01`;
  const yearAgo = daysFromToday(-365);
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    allRows((a, b) => supabase.from("sales_docs").select("id, date, due_date, status, total, exchange_rate, customer:customers(company)").eq("kind", "invoice").neq("status", "draft").neq("status", "cancelled").order("id").range(a, b)),
    allRows((a, b) => supabase.from("payments").select("amount, date, mode:payment_modes(name), invoice:sales_docs(exchange_rate)").gte("date", yearAgo).order("id").range(a, b)),
  ]);
  const inv = invoices ?? [];
  const bals = await balancesFor(supabase, inv.map((i) => i.id));
  const today = todayIST();

  const monthly: ReportTable = {
    key: "sales-monthly",
    title: "Invoiced vs collected",
    description: "Last 6 months, including GST",
    columns: [{ label: "Month" }, { label: "Invoiced", money: true }, { label: "Collected", money: true }],
    rows: months.map((m) => [
      m.label,
      r2(inv.filter((i) => monthOf(i.date) === m.key).reduce((s, i) => s + toBase(Number(i.total), i.exchange_rate), 0)),
      r2((payments ?? []).filter((p) => p.date >= since && monthOf(p.date) === m.key).reduce((s, p) => s + toBase(Number(p.amount), p.invoice?.exchange_rate), 0)),
    ]),
  };

  const buckets = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "90+ days"];
  const aging = buckets.map(() => ({ amount: 0, count: 0 }));
  for (const i of inv) {
    const b = bals.get(i.id);
    const st = docStatus({ kind: "invoice", status: i.status, due_date: i.due_date, total: Number(i.total) }, b, today);
    if (st.key === "paid") continue;
    const days = i.due_date ? Math.floor((new Date(today).getTime() - new Date(i.due_date).getTime()) / 86400_000) : 0;
    const idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    aging[idx]!.amount += toBase(b?.balance ?? Number(i.total), i.exchange_rate);
    aging[idx]!.count++;
  }
  const agingTable: ReportTable = {
    key: "sales-aging",
    title: "Receivables aging",
    description: "Unpaid balance by days past the due date",
    columns: [{ label: "Bucket" }, { label: "Balance", money: true }, { label: "Invoices", numeric: true }],
    rows: buckets.map((b, i) => [b, r2(aging[i]!.amount), aging[i]!.count]),
  };

  const byCustomer = new Map<string, { invoiced: number; outstanding: number }>();
  for (const i of inv.filter((x) => x.date >= yearAgo)) {
    const k = i.customer?.company ?? "—";
    const cur = byCustomer.get(k) ?? { invoiced: 0, outstanding: 0 };
    cur.invoiced += toBase(Number(i.total), i.exchange_rate);
    cur.outstanding += toBase(Math.max(0, bals.get(i.id)?.balance ?? 0), i.exchange_rate);
    byCustomer.set(k, cur);
  }
  const top: ReportTable = {
    key: "sales-customers",
    title: "Top customers",
    description: "Invoiced in the last 12 months",
    columns: [{ label: "Customer" }, { label: "Invoiced", money: true }, { label: "Outstanding", money: true }],
    rows: [...byCustomer.entries()].sort((a, b) => b[1].invoiced - a[1].invoiced).slice(0, 10).map(([k, v]) => [k, r2(v.invoiced), r2(v.outstanding)]),
  };

  const byMode = new Map<string, number>();
  for (const p of payments ?? []) byMode.set(p.mode?.name ?? "Other", (byMode.get(p.mode?.name ?? "Other") ?? 0) + toBase(Number(p.amount), p.invoice?.exchange_rate));
  const modes: ReportTable = {
    key: "sales-modes",
    title: "Collections by payment mode",
    description: "Last 12 months",
    columns: [{ label: "Mode" }, { label: "Collected", money: true }],
    rows: [...byMode.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v)]),
  };
  return [monthly, agingTable, top, modes, ...(await salesExtras(supabase, yearAgo))];
}

/** Revenue by item, and how proposals/estimates convert. */
async function salesExtras(supabase: DB, yearAgo: string): Promise<ReportTable[]> {
  const [{ data: lines }, { data: quotes }] = await Promise.all([
    allRows((a, b) =>
      supabase
        .from("sales_doc_items")
        .select("description, qty, rate, doc:sales_docs!inner(kind, status, date, exchange_rate, discount_percent)")
        .eq("doc.kind", "invoice")
        .in("doc.status", ["sent", "accepted"])
        .gte("doc.date", yearAgo)
        .order("id")
        .range(a, b),
    ),
    allRows((a, b) => supabase.from("sales_docs").select("kind, status, total, exchange_rate").in("kind", ["proposal", "estimate"]).neq("status", "draft").order("id").range(a, b)),
  ]);
  const byItem = new Map<string, { qty: number; amount: number }>();
  for (const l of lines ?? []) {
    const cur = byItem.get(l.description) ?? { qty: 0, amount: 0 };
    cur.qty += Number(l.qty);
    // after the document discount, in the base currency
    cur.amount += toBase(Number(l.qty) * Number(l.rate) * (1 - Number(l.doc?.discount_percent ?? 0) / 100), l.doc?.exchange_rate);
    byItem.set(l.description, cur);
  }
  const items: ReportTable = {
    key: "sales-items",
    title: "Revenue by item",
    description: "Invoiced in the last 12 months, before tax",
    columns: [{ label: "Item" }, { label: "Revenue", money: true }, { label: "Quantity", numeric: true }],
    rows: [...byItem.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 10).map(([k, v]) => [k, r2(v.amount), r2(v.qty)]),
  };
  const conv = (["proposal", "estimate"] as const).map((k) => {
    const qs = (quotes ?? []).filter((q) => q.kind === k);
    const won = qs.filter((q) => q.status === "accepted");
    const lost = qs.filter((q) => q.status === "declined");
    return [k === "proposal" ? "Proposals" : "Estimates", qs.length, won.length, lost.length, qs.length - won.length - lost.length,
      won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0, r2(won.reduce((s, q) => s + toBase(Number(q.total), q.exchange_rate), 0))] as (string | number)[];
  });
  const quotesTable: ReportTable = {
    key: "sales-quotes",
    title: "Quote conversion",
    description: "Proposals and estimates sent, all time",
    columns: [{ label: "Type" }, { label: "Sent", numeric: true }, { label: "Accepted", numeric: true }, { label: "Declined", numeric: true }, { label: "Open", numeric: true }, { label: "Win rate %", numeric: true }, { label: "Won value", money: true }],
    rows: conv,
  };
  return [items, quotesTable];
}

export async function leadReports(supabase: DB): Promise<ReportTable[]> {
  const months = lastMonths(6);
  const [{ data: leads }, { data: sources }, { data: statuses }] = await Promise.all([
    allRows((a, b) => supabase.from("leads").select("created_at, source_id, status_id, value, is_lost, is_junk, converted_customer_id, converted_at").order("id").range(a, b)),
    supabase.from("lead_sources").select("id, name").order("name"),
    supabase.from("lead_statuses").select("id, name, sort_order").order("sort_order"),
  ]);
  const all = (leads ?? []).filter((l) => !l.is_junk);
  const monthly: ReportTable = {
    key: "leads-monthly",
    title: "New leads per month",
    columns: [{ label: "Month" }, { label: "New leads", numeric: true }, { label: "Converted", numeric: true }],
    rows: months.map((m) => [m.label, all.filter((l) => monthOf(l.created_at) === m.key).length, all.filter((l) => l.converted_at && monthOf(l.converted_at) === m.key).length]),
  };
  const bySource: ReportTable = {
    key: "leads-sources",
    title: "Conversion by source",
    columns: [{ label: "Source" }, { label: "Leads", numeric: true }, { label: "Won", numeric: true }, { label: "Lost", numeric: true }, { label: "Win rate %", numeric: true }, { label: "Open pipeline", money: true }],
    rows: (sources ?? [])
      .map((s) => {
        const ls = all.filter((l) => l.source_id === s.id);
        const won = ls.filter((l) => l.converted_customer_id).length;
        const lost = ls.filter((l) => l.is_lost).length;
        const open = ls.filter((l) => !l.converted_customer_id && !l.is_lost).reduce((a, l) => a + Number(l.value ?? 0), 0);
        return [s.name, ls.length, won, lost, won + lost ? Math.round((won / (won + lost)) * 100) : 0, r2(open)] as (string | number)[];
      })
      .filter((r) => (r[1] as number) > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number)),
  };
  const byStage: ReportTable = {
    key: "leads-stages",
    title: "Open pipeline by stage",
    columns: [{ label: "Stage" }, { label: "Leads", numeric: true }, { label: "Value", money: true }],
    rows: (statuses ?? []).map((s) => {
      const ls = all.filter((l) => l.status_id === s.id && !l.converted_customer_id && !l.is_lost);
      return [s.name, ls.length, r2(ls.reduce((a, l) => a + Number(l.value ?? 0), 0))];
    }),
  };
  // Win rate by lead owner
  const { data: owned } = await allRows((a, b) => supabase.from("leads").select("assigned_to, is_lost, converted_customer_id, value, owner:profiles!leads_assigned_to_fkey(full_name)").order("id").range(a, b));
  const byOwner = new Map<string, { leads: number; won: number; lost: number; wonValue: number }>();
  for (const l of owned ?? []) {
    const k = l.owner?.full_name ?? "Unassigned";
    const cur = byOwner.get(k) ?? { leads: 0, won: 0, lost: 0, wonValue: 0 };
    cur.leads++;
    if (l.converted_customer_id) { cur.won++; cur.wonValue += Number(l.value ?? 0); }
    if (l.is_lost) cur.lost++;
    byOwner.set(k, cur);
  }
  const byStaff: ReportTable = {
    key: "leads-staff",
    title: "Conversion by owner",
    description: "All leads, by who they're assigned to",
    columns: [{ label: "Owner" }, { label: "Win rate %", numeric: true }, { label: "Leads", numeric: true }, { label: "Won", numeric: true }, { label: "Lost", numeric: true }, { label: "Won value", money: true }],
    rows: [...byOwner.entries()].sort((a, b) => b[1].leads - a[1].leads).map(([k, v]) => [k, v.won + v.lost ? Math.round((v.won / (v.won + v.lost)) * 100) : 0, v.leads, v.won, v.lost, r2(v.wonValue)]),
  };
  return [monthly, bySource, byStage, byStaff];
}

export async function expenseReports(supabase: DB): Promise<ReportTable[]> {
  const months = lastMonths(6);
  const yearAgo = daysFromToday(-365);
  const [{ data: exps }, { data: cats }] = await Promise.all([
    allRows((a, b) => supabase.from("expenses").select("amount, tax_rate, date, category_id, is_billable, invoice_id").gte("date", yearAgo).order("id").range(a, b)),
    supabase.from("expense_categories").select("id, name"),
  ]);
  const gross = (e: { amount: number; tax_rate: number }) => Number(e.amount) * (1 + Number(e.tax_rate) / 100);
  const all = exps ?? [];
  return [
    {
      key: "expenses-monthly",
      title: "Spend per month",
      description: "Including GST",
      columns: [{ label: "Month" }, { label: "Spend", money: true }],
      rows: months.map((m) => [m.label, r2(all.filter((e) => monthOf(e.date) === m.key).reduce((s, e) => s + gross(e), 0))]),
    },
    {
      key: "expenses-categories",
      title: "Spend by category",
      description: "Last 12 months",
      columns: [{ label: "Category" }, { label: "Spend", money: true }, { label: "Entries", numeric: true }],
      rows: (cats ?? [])
        .map((c) => {
          const es = all.filter((e) => e.category_id === c.id);
          return [c.name, r2(es.reduce((s, e) => s + gross(e), 0)), es.length] as (string | number)[];
        })
        .filter((r) => (r[2] as number) > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number)),
    },
    {
      key: "expenses-billable",
      title: "Billable expenses",
      columns: [{ label: "Status" }, { label: "Amount", money: true }],
      rows: [
        ["Billed to customers", r2(all.filter((e) => e.is_billable && e.invoice_id).reduce((s, e) => s + gross(e), 0))],
        ["Billable, not yet invoiced", r2(all.filter((e) => e.is_billable && !e.invoice_id).reduce((s, e) => s + gross(e), 0))],
        ["Internal", r2(all.filter((e) => !e.is_billable).reduce((s, e) => s + gross(e), 0))],
      ],
    },
    // Perfex's yearly expenses report: each category month by month, with totals
    (() => {
      const year = lastMonths(12);
      const ids = [...new Set(all.map((e) => e.category_id))];
      const name = (id: number | null) => (cats ?? []).find((c) => c.id === id)?.name ?? "Uncategorised";
      const line = (pick: (e: (typeof all)[number]) => boolean) => {
        const cells = year.map((m) => r2(all.filter((e) => pick(e) && monthOf(e.date) === m.key).reduce((s, e) => s + gross(e), 0)));
        return [...cells, r2(cells.reduce((s, v) => s + v, 0))];
      };
      const rows = ids.map((id) => [name(id), ...line((e) => e.category_id === id)]).sort((a, b) => (b.at(-1) as number) - (a.at(-1) as number));
      return {
        key: "expenses-matrix",
        title: "Category by month",
        description: "Last 12 months, including GST",
        columns: [{ label: "Category" }, ...year.map((m) => ({ label: m.label, money: true })), { label: "Total", money: true }],
        rows: rows.length ? [...rows, ["Total", ...line(() => true)]] : [],
      };
    })(),
  ];
}

export async function timeReports(supabase: DB): Promise<ReportTable[]> {
  const ninety = daysFromToday(-90);
  const { data: rows } = await allRows((a, b) =>
    supabase
      .from("timesheets")
      .select("hours, is_billable, invoice_id, date, staff:profiles(full_name), project:projects(name, billing_type, hourly_rate)")
      .gte("date", ninety)
      .order("id")
      .range(a, b),
  );
  const all = rows ?? [];
  const byStaff = new Map<string, { total: number; billable: number }>();
  const byProject = new Map<string, { total: number; billable: number; unbilled: number; value: number }>();
  for (const t of all) {
    const h = Number(t.hours);
    const s = byStaff.get(t.staff?.full_name ?? "—") ?? { total: 0, billable: 0 };
    s.total += h;
    if (t.is_billable) s.billable += h;
    byStaff.set(t.staff?.full_name ?? "—", s);
    const p = byProject.get(t.project?.name ?? "—") ?? { total: 0, billable: 0, unbilled: 0, value: 0 };
    p.total += h;
    if (t.is_billable) p.billable += h;
    if (t.is_billable && !t.invoice_id && t.project?.billing_type === "hourly") {
      p.unbilled += h;
      p.value += h * Number(t.project.hourly_rate ?? 0);
    }
    byProject.set(t.project?.name ?? "—", p);
  }
  return [
    {
      key: "time-staff",
      title: "Hours by team member",
      description: "Last 90 days",
      columns: [{ label: "Team member" }, { label: "Hours", numeric: true }, { label: "Billable", numeric: true }, { label: "Billable %", numeric: true }],
      rows: [...byStaff.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [k, r2(v.total), r2(v.billable), v.total ? Math.round((v.billable / v.total) * 100) : 0]),
    },
    {
      key: "time-projects",
      title: "Hours by project",
      description: "Last 90 days",
      columns: [{ label: "Project" }, { label: "Hours", numeric: true }, { label: "Billable", numeric: true }, { label: "Unbilled hours", numeric: true }, { label: "Unbilled value", money: true }],
      rows: [...byProject.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [k, r2(v.total), r2(v.billable), r2(v.unbilled), r2(v.value)]),
    },
  ];
}

export async function supportReports(supabase: DB): Promise<ReportTable[]> {
  const months = lastMonths(6);
  const [{ data: tickets }, { data: depts }] = await Promise.all([
    allRows((a, b) => supabase.from("tickets").select("created_at, closed_at, status, department_id, priority, ticket_replies(count)").order("id").range(a, b)),
    supabase.from("ticket_departments").select("id, name"),
  ]);
  const all = tickets ?? [];
  const replies = (t: (typeof all)[number]) => (t.ticket_replies as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
  return [
    {
      key: "support-monthly",
      title: "Tickets opened vs closed",
      columns: [{ label: "Month" }, { label: "Opened", numeric: true }, { label: "Closed", numeric: true }],
      rows: months.map((m) => [m.label, all.filter((t) => monthOf(t.created_at) === m.key).length, all.filter((t) => t.closed_at && monthOf(t.closed_at) === m.key).length]),
    },
    {
      key: "support-departments",
      title: "Tickets by department",
      columns: [{ label: "Department" }, { label: "Total", numeric: true }, { label: "Open", numeric: true }, { label: "Urgent / high", numeric: true }, { label: "Avg. messages", numeric: true }],
      rows: [...(depts ?? []), { id: 0, name: "No department" }]
        .map((d) => {
          const ts = all.filter((t) => (t.department_id ?? 0) === d.id);
          return [d.name, ts.length, ts.filter((t) => t.status !== "closed").length, ts.filter((t) => t.priority === "urgent" || t.priority === "high").length, ts.length ? r2(ts.reduce((s, t) => s + replies(t), 0) / ts.length) : 0] as (string | number)[];
        })
        .filter((r) => (r[1] as number) > 0),
    },
  ];
}

/** Expenses vs income: money collected against money spent, month by month. */
export async function incomeReports(supabase: DB): Promise<ReportTable[]> {
  const months = lastMonths(12);
  const since = `${months[0]!.key}-01`;
  const [{ data: exps }, { data: pays }] = await Promise.all([
    allRows((a, b) => supabase.from("expenses").select("amount, tax_rate, date").gte("date", since).order("id").range(a, b)),
    allRows((a, b) => supabase.from("payments").select("amount, date, invoice:sales_docs(exchange_rate)").gte("date", since).order("id").range(a, b)),
  ]);
  const gross = (e: { amount: number; tax_rate: number }) => Number(e.amount) * (1 + Number(e.tax_rate) / 100);
  const inOf = (keys: string[]) => (pays ?? []).filter((p) => keys.includes(monthOf(p.date))).reduce((s, p) => s + toBase(Number(p.amount), p.invoice?.exchange_rate), 0);
  const outOf = (keys: string[]) => (exps ?? []).filter((e) => keys.includes(monthOf(e.date))).reduce((s, e) => s + gross(e), 0);
  const keys = months.map((m) => m.key);
  const period = (label: string, ks: string[]) => {
    const i = inOf(ks);
    const o = outOf(ks);
    return [label, r2(i), r2(o), r2(i - o), i ? Math.round(((i - o) / i) * 100) : 0];
  };
  return [
    {
      key: "income-monthly",
      title: "Expenses vs income",
      description: "Payments collected vs expenses (incl. GST), last 12 months",
      columns: [{ label: "Month" }, { label: "Income", money: true }, { label: "Expenses", money: true }, { label: "Net", money: true }],
      rows: months.map((m) => [m.label, r2(inOf([m.key])), r2(outOf([m.key])), r2(inOf([m.key]) - outOf([m.key]))]),
    },
    {
      key: "income-summary",
      title: "Net by period",
      columns: [{ label: "Period" }, { label: "Income", money: true }, { label: "Expenses", money: true }, { label: "Net", money: true }, { label: "Margin %", numeric: true }],
      rows: [period("This month", keys.slice(-1)), period("Last 3 months", keys.slice(-3)), period("Last 12 months", keys)],
    },
  ];
}

/** Knowledge base: which articles are read and whether they help. */
export async function kbReports(supabase: DB): Promise<ReportTable[]> {
  const { data: arts } = await allRows((a, b) =>
    supabase.from("kb_articles").select("title, views, helpful, not_helpful, is_published, group:kb_groups(name)").order("id").range(a, b),
  );
  const all = arts ?? [];
  const byGroup = new Map<string, number>();
  for (const a of all) byGroup.set(a.group?.name ?? "Uncategorised", (byGroup.get(a.group?.name ?? "Uncategorised") ?? 0) + Number(a.views));
  return [
    {
      key: "kb-articles",
      title: "Articles",
      description: "Views and “was this helpful?” votes from the client portal",
      columns: [{ label: "Article" }, { label: "Category" }, { label: "Views", numeric: true }, { label: "Helpful", numeric: true }, { label: "Not helpful", numeric: true }, { label: "Helpful %", numeric: true }],
      rows: [...all]
        .sort((a, b) => Number(b.views) - Number(a.views))
        .map((a) => {
          const votes = Number(a.helpful) + Number(a.not_helpful);
          return [`${a.title}${a.is_published ? "" : " (draft)"}`, a.group?.name ?? "—", Number(a.views), Number(a.helpful), Number(a.not_helpful), votes ? Math.round((Number(a.helpful) / votes) * 100) : 0];
        }),
    },
    {
      key: "kb-groups",
      title: "Views by category",
      columns: [{ label: "Category" }, { label: "Views", numeric: true }],
      rows: [...byGroup.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]),
    },
  ];
}

/** Periods for the detailed reports (Perfex: "Report period"); defaults to this year. */
export const DETAIL_PERIODS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "fy", label: "This financial year" },
  { value: "all", label: "All time" },
];
export const detailRange = (period?: string): [string, string] =>
  period === "all" ? ["2000-01-01", "2999-12-31"] : (periodRange(period ?? "this_year") ?? periodRange("this_year")!);

/** Perfex's detailed sales reports: invoices, payments received, credit notes and customer-group value in a period. */
export async function detailReports(supabase: DB, period?: string): Promise<ReportTable[]> {
  const [from, to] = detailRange(period);
  const label = DETAIL_PERIODS.find((p) => p.value === (period ?? "this_year"))?.label ?? "This year";
  const [{ data: invoices }, { data: payments }, { data: credits }, { data: groups }] = await Promise.all([
    allRows((a, b) => supabase.from("sales_docs").select("id, number, date, due_date, status, subtotal, tax_total, total, exchange_rate, customer:customers(company, group_id)").eq("kind", "invoice").neq("status", "draft").gte("date", from).lte("date", to).order("date").order("id").range(a, b)),
    allRows((a, b) => supabase.from("payments").select("id, date, amount, transaction_id, mode:payment_modes(name), invoice:sales_docs(number, exchange_rate, customer:customers(company, group_id))").gte("date", from).lte("date", to).order("date").order("id").range(a, b)),
    allRows((a, b) => supabase.from("sales_docs").select("id, number, date, status, total, exchange_rate, customer:customers(company)").eq("kind", "credit_note").neq("status", "draft").gte("date", from).lte("date", to).order("date").order("id").range(a, b)),
    supabase.from("customer_groups").select("id, name").order("name"),
  ]);
  const bals = await balancesFor(supabase, [...(invoices ?? []).map((d) => d.id), ...(credits ?? []).map((d) => d.id)]);
  const b = (amount: number, rate: number | null) => toBase(Number(amount), rate);

  const invoiceRows = (invoices ?? []).map((d) => {
    const bal = bals.get(d.id);
    const st = docStatus({ kind: "invoice", status: d.status, due_date: d.due_date, total: Number(d.total) }, bal);
    const rate = d.exchange_rate;
    return [docNumber("invoice", d.number), d.customer?.company ?? "—", d.date, d.due_date ?? "—", st.label,
      b(d.subtotal, rate), b(d.tax_total, rate), b(d.total, rate), b((bal?.paid ?? 0) + (bal?.credited ?? 0), rate), d.status === "cancelled" ? 0 : b(Math.max(0, bal?.balance ?? Number(d.total)), rate)];
  });
  const paymentRows = (payments ?? []).map((p) => [p.date, receiptNumber(p.id), p.invoice ? docNumber("invoice", p.invoice.number) : "—", p.invoice?.customer?.company ?? "—", p.mode?.name ?? "—", p.transaction_id ?? "—", b(p.amount, p.invoice?.exchange_rate ?? 1)]);
  const creditRows = (credits ?? []).map((d) => {
    const bal = bals.get(d.id);
    const st = docStatus({ kind: "credit_note", status: d.status, due_date: null, total: Number(d.total) }, bal);
    const rate = d.exchange_rate;
    return [docNumber("credit_note", d.number), d.customer?.company ?? "—", d.date, st.label, b(d.total, rate), b(bal?.credit_used ?? 0, rate), b(bal?.refunded ?? 0, rate), d.status === "cancelled" ? 0 : b(Math.max(0, bal?.balance ?? Number(d.total)), rate)];
  });
  // Customer groups value: invoiced and received in the period, by the customer's group
  const byGroup = new Map<number | null, { invoiced: number; paid: number; customers: Set<string> }>();
  const slot = (g: number | null) => byGroup.get(g) ?? byGroup.set(g, { invoiced: 0, paid: 0, customers: new Set() }).get(g)!;
  for (const d of invoices ?? []) if (d.status !== "cancelled") { const s = slot(d.customer?.group_id ?? null); s.invoiced += b(d.total, d.exchange_rate); if (d.customer) s.customers.add(d.customer.company); }
  for (const p of payments ?? []) slot(p.invoice?.customer?.group_id ?? null).paid += b(p.amount, p.invoice?.exchange_rate ?? 1);
  const groupRows = [...byGroup.entries()]
    .map(([g, v]) => [g == null ? "No group" : ((groups ?? []).find((x) => x.id === g)?.name ?? "—"), r2(v.invoiced), r2(v.paid), v.customers.size] as (string | number)[])
    .sort((x, y) => Number(y[1]) - Number(x[1]));

  const money = (label: string) => ({ label, money: true });
  return [
    {
      key: "detail-invoices", title: "Invoices report", description: `${label} · ${invoiceRows.length} invoices (drafts excluded), in base currency`,
      columns: [{ label: "Invoice" }, { label: "Customer" }, { label: "Date" }, { label: "Due" }, { label: "Status" }, money("Sub total"), money("Tax"), money("Total"), money("Paid / credited"), money("Balance")],
      rows: invoiceRows,
    },
    {
      key: "detail-payments", title: "Payments received", description: `${label} · ${paymentRows.length} payments, in base currency`,
      columns: [{ label: "Date" }, { label: "Receipt" }, { label: "Invoice" }, { label: "Customer" }, { label: "Mode" }, { label: "Transaction / UTR" }, money("Amount")],
      rows: paymentRows,
    },
    {
      key: "detail-credit-notes", title: "Credit notes report", description: `${label} · ${creditRows.length} credit notes, in base currency`,
      columns: [{ label: "Credit note" }, { label: "Customer" }, { label: "Date" }, { label: "Status" }, money("Total"), money("Applied"), money("Refunded"), money("Remaining")],
      rows: creditRows,
    },
    {
      key: "detail-groups", title: "Customer groups value", description: `${label} · invoiced and received per customer group`,
      columns: [{ label: "Group" }, money("Invoiced"), money("Received"), { label: "Customers", numeric: true }],
      rows: groupRows,
    },
  ];
}

export async function reportsFor(tab: string, supabase: DB, period?: string) {
  switch (tab) {
    case "sales": return salesReports(supabase);
    case "detail": return detailReports(supabase, period);
    case "leads": return leadReports(supabase);
    case "expenses": return expenseReports(supabase);
    case "income": return incomeReports(supabase);
    case "kb": return kbReports(supabase);
    case "time": return timeReports(supabase);
    case "support": return supportReports(supabase);
    default: return [];
  }
}

export function toCsv(t: ReportTable) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns.map((c) => esc(c.label)).join(","), ...t.rows.map((r) => r.map(esc).join(","))].join("\n");
}
