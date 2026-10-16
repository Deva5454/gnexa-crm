import Link from "next/link";
import { FolderKanban, ListChecks, Magnet, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { salesOverview } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/** Perfex's top row: four "x / total" stats with a progress bar each. */
export async function TopStats({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  const none = Promise.resolve(null);
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [sales, leads, converted, projects, inProgress, tasks, open] = await Promise.all([
    salesOverview(),
    can("leads", "view") ? count(supabase.from("leads").select("id", { count: "exact", head: true })) : none,
    can("leads", "view") ? count(supabase.from("leads").select("id", { count: "exact", head: true }).not("converted_customer_id", "is", null)) : none,
    can("projects", "view") ? count(supabase.from("projects").select("id", { count: "exact", head: true })) : none,
    can("projects", "view") ? count(supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "in_progress")) : none,
    can("tasks", "view") ? count(supabase.from("tasks").select("id", { count: "exact", head: true })) : none,
    can("tasks", "view") ? count(supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "complete")) : none,
  ]);

  const stats = [
    sales && { label: "Invoices awaiting payment", x: sales.awaiting, y: sales.billable, icon: ReceiptText, href: "/sales/invoices?status=unpaid", bar: "bg-rose-500" },
    leads != null && { label: "Converted leads", x: converted ?? 0, y: leads, icon: Magnet, href: "/leads?view=list", bar: "bg-emerald-500" },
    projects != null && { label: "Projects in progress", x: inProgress ?? 0, y: projects, icon: FolderKanban, href: "/projects?status=in_progress", bar: "bg-sky-500" },
    tasks != null && { label: "Tasks not finished", x: open ?? 0, y: tasks, icon: ListChecks, href: "/tasks", bar: "bg-amber-500" },
  ].filter(Boolean) as { label: string; x: number; y: number; icon: typeof Magnet; href: string; bar: string }[];
  if (!stats.length) return null;

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {stats.map((s) => {
        const pct = s.y ? Math.round((s.x / s.y) * 100) : 0;
        return (
          <Link key={s.label} href={s.href} className="group">
            <Card className="p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <s.icon className="h-4 w-4 text-slate-400" aria-hidden />
                  {s.label}
                </div>
                <span className="text-xs font-semibold text-slate-500">{pct}%</span>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {s.x} <span className="text-base font-medium text-slate-400">/ {s.y}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-label={s.label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-1.5 rounded-full", s.bar)} style={{ width: `${pct}%` }} />
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
