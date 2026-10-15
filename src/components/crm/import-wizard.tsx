"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { autoMap, parseCsv, type ImportField, type ImportResult } from "@/lib/csv";

export function ImportWizard({
  fields,
  action,
  sample,
  sampleName,
  doneHref,
  noun,
}: {
  fields: ImportField[];
  action: (rows: Record<string, string>[]) => Promise<ImportResult>;
  sample: string;
  sampleName: string;
  doneHref: string;
  noun: string;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const headers = rows?.[0] ?? [];
  const body = useMemo(() => (rows ?? []).slice(1), [rows]);

  const load = (text: string) => {
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setError("That file has no data rows.");
    if (parsed.length > 501) return setError("Please import at most 500 rows at a time.");
    setError(null);
    setResult(null);
    setRows(parsed);
    setMap(autoMap(parsed[0]!, fields));
  };
  const missing = fields.filter((f) => f.required && map[f.key] === undefined);
  const records = () => body.map((r) => Object.fromEntries(Object.entries(map).map(([k, i]) => [k, r[i] ?? ""])));

  if (result)
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-lg font-semibold">{result.created} {noun}{result.created === 1 ? "" : "s"} imported</span>
          </div>
          {result.skipped.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              <b>{result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped</b>
              <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5">
                {result.skipped.slice(0, 50).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Link href={doneHref} className={buttonClass({})}>Done</Link>
            <button type="button" onClick={() => { setRows(null); setResult(null); }} className={buttonClass({ variant: "secondary" })}>Import another file</button>
          </div>
        </CardBody>
      </Card>
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="1 · Choose a CSV file"
          description="Export from Excel or Google Sheets as CSV. The first row must be column headings."
          action={
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`} download={sampleName} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800">
              <Download className="h-3.5 w-3.5" /> Sample file
            </a>
          }
        />
        <CardBody>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40">
            <Upload className="h-5 w-5 text-brand-500" />
            <span><b className="text-slate-700">{rows ? "Choose a different file" : "Choose CSV file"}</b> · up to 500 rows</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) load(await f.text());
              }}
            />
          </label>
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </CardBody>
      </Card>

      {rows && (
        <>
          <Card>
            <CardHeader title="2 · Match the columns" description={`${body.length} rows found. We guessed the matches — check them.`} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-slate-700">{f.label}{f.required && <span className="text-rose-500"> *</span>}</span>
                  <select
                    value={map[f.key] ?? ""}
                    onChange={(e) => setMap((m) => {
                      const n = { ...m };
                      if (e.target.value === "") delete n[f.key];
                      else n[f.key] = Number(e.target.value);
                      return n;
                    })}
                    className="field"
                  >
                    <option value="">— Don&apos;t import —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="3 · Preview" description="First 5 rows as they will be imported" />
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr>{fields.filter((f) => map[f.key] !== undefined).map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
                <tbody>
                  {body.slice(0, 5).map((r, i) => (
                    <tr key={i}>{fields.filter((f) => map[f.key] !== undefined).map((f) => <td key={f.key} className="max-w-[200px] truncate">{r[map[f.key]!] ?? ""}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <span className="flex items-center gap-2 text-sm text-slate-500">
                <FileSpreadsheet className="h-4 w-4" />
                {missing.length ? <span className="text-rose-600">Match a column for: {missing.map((m) => m.label).join(", ")}</span> : `Ready to import ${body.length} rows. Duplicates are skipped.`}
              </span>
              <button
                type="button"
                disabled={pending || missing.length > 0}
                onClick={() => start(async () => {
                  const r = await action(records());
                  if (r.error) setError(r.error);
                  else setResult(r);
                })}
                className={buttonClass({})}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {body.length} rows
              </button>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
