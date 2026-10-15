import { cn } from "@/lib/utils";

// Validated categorical pair (light surface): violet + dark teal — distinct for colour-blind readers, ≥3:1 contrast.
export const SERIES_COLORS = ["#6d55f2", "#0d9488"] as const;

export type Fmt = "money" | "number";
const fmt = (v: number, f: Fmt) =>
  f === "money" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v) : new Intl.NumberFormat("en-IN").format(v);
const compact = (v: number, f: Fmt) =>
  (f === "money" ? "₹" : "") + new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v);

/** Nice round axis maximum and 4 gridline steps. */
function axis(max: number) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * step) };
}

/** Vertical bars over months/categories; one or two series (grouped). Hover a column for exact values. */
export function ColumnChart({ labels, series, format }: { labels: string[]; series: { name: string; values: number[] }[]; format: Fmt }) {
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const { top, ticks } = axis(max);
  const H = 180;
  return (
    <figure>
      {series.length > 1 && (
        <figcaption className="mb-6 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />{s.name}</span>
          ))}
        </figcaption>
      )}
      <div className="flex gap-2">
        <div className="relative w-12 shrink-0 text-right text-[10px] text-slate-400" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>{compact(t, format)}</span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className={cn("absolute inset-x-0 border-t", t === 0 ? "border-slate-300" : "border-dashed border-slate-100")} style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-2 sm:gap-4">
            {labels.map((label, li) => (
              <div key={label + li} className="group relative flex h-full flex-1 items-end justify-center gap-[2px]">
                {series.map((s, si) => (
                  <div
                    key={s.name}
                    className="w-full max-w-[28px] rounded-t transition-opacity group-hover:opacity-80"
                    style={{ height: `${(s.values[li]! / top) * 100}%`, minHeight: s.values[li]! > 0 ? 2 : 0, background: SERIES_COLORS[si] }}
                  />
                ))}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink-900 px-3 py-2 text-xs text-white shadow-pop group-hover:block">
                  <div className="mb-1 font-semibold">{label}</div>
                  {series.map((s, si) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: SERIES_COLORS[si] }} />
                      <span className="text-slate-300">{s.name}</span>
                      <span className="ml-auto font-semibold">{fmt(s.values[li]!, format)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-14 mt-2 flex gap-2 sm:gap-4">
        {labels.map((l, i) => <div key={l + i} className="flex-1 text-center text-[11px] text-slate-500">{l}</div>)}
      </div>
    </figure>
  );
}

/** Ranked horizontal bars with direct value labels — for categories (customers, sources, buckets). */
export function BarList({ items, format }: { items: { label: string; value: number; sub?: string }[]; format: Fmt }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-700">{i.label}</span>
            <span className="shrink-0 font-semibold text-slate-900">{fmt(i.value, format)}{i.sub && <span className="ml-1 font-normal text-slate-400">{i.sub}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full transition-opacity group-hover:opacity-80" style={{ width: `${(i.value / max) * 100}%`, minWidth: i.value > 0 ? 4 : 0, background: SERIES_COLORS[0] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
