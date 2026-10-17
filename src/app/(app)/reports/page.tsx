import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { BarList, ColumnChart, type Fmt } from "@/components/reports/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requireStaff } from "@/lib/auth";
import { DETAIL_PERIODS, REPORT_TABS, reportsFor, type ReportTable } from "@/lib/reports";
import { ParamSelect } from "@/components/ui/param-select";
import { formatMoney } from "@/lib/utils";
import { baseCurrency } from "@/lib/sales-data";

export const metadata: Metadata = { title: "Reports" };

// How each report is drawn: columns over time, ranked bars, or table only
const CHART: Record<string, { kind: "columns" | "bars" | "table"; series?: number[]; value?: number; sub?: number; wide?: boolean }> = {
  "sales-monthly": { kind: "columns", series: [1, 2], wide: true },
  "sales-aging": { kind: "bars", value: 1, sub: 2 },
  "sales-customers": { kind: "bars", value: 1 },
  "sales-modes": { kind: "bars", value: 1 },
  "sales-items": { kind: "bars", value: 1 },
  "sales-quotes": { kind: "table" },
  "leads-staff": { kind: "bars", value: 1, sub: 2 },
  "income-monthly": { kind: "columns", series: [1, 2], wide: true },
  "income-summary": { kind: "table", wide: true },
  "kb-articles": { kind: "table", wide: true },
  "kb-groups": { kind: "bars", value: 1 },
  "leads-monthly": { kind: "columns", series: [1, 2], wide: true },
  "leads-sources": { kind: "table", wide: true },
  "leads-stages": { kind: "bars", value: 2, sub: 1 },
  "expenses-monthly": { kind: "columns", series: [1], wide: true },
  "expenses-categories": { kind: "bars", value: 1 },
  "expenses-billable": { kind: "bars", value: 1 },
  "expenses-matrix": { kind: "table", wide: true },
  "time-staff": { kind: "bars", value: 1 },
  "time-projects": { kind: "table", wide: true },
  "support-monthly": { kind: "columns", series: [1, 2], wide: true },
  "support-departments": { kind: "table", wide: true },
  "detail-invoices": { kind: "table", wide: true },
  "detail-payments": { kind: "table", wide: true },
  "detail-credit-notes": { kind: "table", wide: true },
  "detail-groups": { kind: "bars", value: 1, sub: 3 },
};

function cell(t: ReportTable, ci: number, v: string | number, currency: string) {
  if (typeof v !== "number") return v;
  return t.columns[ci]!.money ? formatMoney(v, currency) : new Intl.NumberFormat("en-IN").format(v);
}

function DataTable({ t, currency }: { t: ReportTable; currency: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead><tr>{t.columns.map((c) => <th key={c.label} className={c.money || c.numeric ? "text-right" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>
          {t.rows.slice(0, SHOWN).map((r, ri) => (
            <tr key={ri}>{r.map((v, ci) => <td key={ci} className={typeof v === "number" ? "whitespace-nowrap text-right tabular-nums" : "whitespace-nowrap font-medium text-slate-700"}>{cell(t, ci, v, currency)}</td>)}</tr>
          ))}
          {!t.rows.length && <tr><td colSpan={t.columns.length} className="py-6 text-center text-slate-400">No data yet.</td></tr>}
          {t.rows.length > SHOWN && <tr><td colSpan={t.columns.length} className="py-3 text-center text-xs text-slate-400">Showing the first {SHOWN} of {t.rows.length} rows — the CSV has them all.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Long tables show their first rows on screen; the CSV always has every row
const SHOWN = 100;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string }> }) {
  const { tab: requested, period } = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("reports", "view")) notFound();
  const tabs = REPORT_TABS.filter((t) => can(t.module, "view"));
  if (!tabs.length) notFound();
  const tab = tabs.find((t) => t.key === requested)?.key ?? tabs[0]!.key;
  const [tables, base] = await Promise.all([reportsFor(tab, supabase, period), baseCurrency(supabase)]);

  return (
    <>
      <PageHeader title="Reports" description="How the business is doing — every chart has its numbers underneath and a CSV export." />
      <Tabs tabs={tabs.map((t) => ({ key: t.key, label: t.label, href: `/reports?tab=${t.key}` }))} active={tab} />
      {tab === "detail" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>Report period</span>
          <ParamSelect name="period" label="Report period" allLabel="This year" options={DETAIL_PERIODS.filter((p) => p.value !== "this_year")} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {tables.map((t) => {
          const cfg = CHART[t.key] ?? { kind: "table" as const };
          const fmtOf = (ci: number): Fmt => (t.columns[ci]?.money ? "money" : "number");
          return (
            <Card key={t.key} className={cfg.wide ? "xl:col-span-2" : undefined}>
              <CardHeader
                title={t.title}
                description={t.description}
                action={
                  <a href={`/reports/export?report=${t.key}${period ? `&period=${period}` : ""}`} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-brand-700">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </a>
                }
              />
              {cfg.kind !== "table" && (
                <CardBody>
                  {cfg.kind === "columns" ? (
                    <ColumnChart
                      labels={t.rows.map((r) => String(r[0]))}
                      series={cfg.series!.map((ci) => ({ name: t.columns[ci]!.label, values: t.rows.map((r) => Number(r[ci])) }))}
                      format={fmtOf(cfg.series![0]!)}
                    />
                  ) : (
                    <BarList
                      format={fmtOf(cfg.value!)}
                      items={t.rows.map((r) => ({
                        label: String(r[0]),
                        value: Number(r[cfg.value!]),
                        sub: cfg.sub != null ? `· ${r[cfg.sub]} ${t.columns[cfg.sub]!.label.toLowerCase()}` : undefined,
                      }))}
                    />
                  )}
                </CardBody>
              )}
              {cfg.kind === "table" ? (
                <DataTable t={t} currency={base} />
              ) : (
                <details className="border-t border-slate-100">
                  <summary className="cursor-pointer px-5 py-2.5 text-xs font-medium text-slate-500 hover:text-brand-700">Show table</summary>
                  <DataTable t={t} currency={base} />
                </details>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
