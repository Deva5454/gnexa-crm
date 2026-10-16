import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { TICKET_STATUSES } from "@/lib/constants";

const STATUS_FILL: Record<string, string> = {
  open: "#e11d48",
  in_progress: "#0ea5e9",
  answered: "#10b981",
  on_hold: "#f59e0b",
};

function Bars({ title, rows, total }: { title: string; rows: { key: string; label: string; count: number; href: string; color: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="p-5" aria-label={title}>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {!rows.length || !total ? (
        <p className="py-6 text-center text-sm text-slate-400">Nothing waiting.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="grid grid-cols-[110px_1fr_28px] items-center gap-3 rounded-md text-sm hover:bg-slate-50">
                <span className="truncate font-medium text-slate-700">{r.label}</span>
                <div className="h-5 rounded bg-slate-100">
                  <div className="h-5 rounded" style={{ width: `${(r.count / max) * 100}%`, background: r.color, minWidth: r.count ? 4 : 0 }} />
                </div>
                <span className="text-right font-semibold text-slate-900">{r.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Perfex "Tickets awaiting reply" by department, and all unresolved tickets by status. */
export async function TicketsChart({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  if (!can("support", "view")) return null;
  const [{ data: tickets }, { data: depts }] = await Promise.all([
    supabase.from("tickets").select("status, department_id").neq("status", "closed"),
    supabase.from("ticket_departments").select("id, name").order("name"),
  ]);
  const all = tickets ?? [];
  // Awaiting a reply from us: opened or in progress (answered / on hold are waiting on the customer)
  const awaiting = all.filter((t) => t.status === "open" || t.status === "in_progress");
  const byDept = [
    ...(depts ?? []).map((d) => ({ key: String(d.id), label: d.name, count: awaiting.filter((t) => t.department_id === d.id).length, href: `/support?dept=${d.id}`, color: "rgb(var(--brand-500))" })),
    { key: "none", label: "No department", count: awaiting.filter((t) => t.department_id == null).length, href: "/support", color: "#94a3b8" },
  ].filter((r) => r.count > 0);
  const byStatus = TICKET_STATUSES.filter((s) => s.value !== "closed").map((s) => ({
    key: s.value,
    label: s.label,
    count: all.filter((t) => t.status === s.value).length,
    href: `/support?status=${s.value}`,
    color: STATUS_FILL[s.value] ?? "#94a3b8",
  }));

  return (
    <Card className={className}>
      <CardHeader
        title="Tickets awaiting reply"
        description={`${awaiting.length} awaiting reply · ${all.length} unresolved`}
        action={<Link href="/support" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Support →</Link>}
      />
      <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        <Bars title="Awaiting reply · by department" rows={byDept} total={awaiting.length} />
        <Bars title="Unresolved · by status" rows={byStatus} total={all.length} />
      </div>
    </Card>
  );
}
