import Link from "next/link";
import { FileWarning, FolderKanban, LifeBuoy, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { contractState } from "@/lib/constants";
import { daysFromToday } from "@/lib/dates";

/** Delivery at a glance: projects, tickets, hours this week, contracts needing attention. */
export async function WorkStrip() {
  const { supabase, can, profile } = await requireStaff();
  const weekAgo = daysFromToday(-6);
  const [{ data: projects }, { data: tickets }, { data: hours }, { data: contracts }] = await Promise.all([
    can("projects", "view") ? supabase.from("projects").select("status") : Promise.resolve({ data: null }),
    can("support", "view") ? supabase.from("tickets").select("status, assigned_to, priority").neq("status", "closed") : Promise.resolve({ data: null }),
    can("projects", "view") ? supabase.from("timesheets").select("hours").eq("staff_id", profile.id).gte("date", weekAgo) : Promise.resolve({ data: null }),
    can("contracts", "view") ? supabase.from("contracts").select("status, start_date, end_date") : Promise.resolve({ data: null }),
  ]);
  const tiles = [
    projects && { label: "Active projects", value: String(projects.filter((p) => p.status === "in_progress").length), sub: `${projects.filter((p) => p.status === "on_hold").length} on hold`, icon: FolderKanban, href: "/projects?status=in_progress", tone: "text-brand-600" },
    tickets && { label: "Open tickets", value: String(tickets.length), sub: `${tickets.filter((t) => t.assigned_to === profile.id).length} assigned to you`, icon: LifeBuoy, href: "/support", tone: tickets.some((t) => t.priority === "urgent") ? "text-rose-600" : "text-slate-900" },
    hours && { label: "My hours (7 days)", value: `${hours.reduce((s, h) => s + Number(h.hours), 0)} h`, sub: "from timesheets", icon: Timer, href: "/projects?mine=1", tone: "text-slate-900" },
    contracts && {
      label: "Contracts to renew",
      value: String(contracts.filter((c) => contractState(c).key === "expiring").length),
      sub: `${contracts.filter((c) => contractState(c).key === "expired").length} expired`,
      icon: FileWarning,
      href: "/contracts?state=expiring",
      tone: "text-amber-600",
    },
  ].filter(Boolean) as { label: string; value: string; sub: string; icon: typeof Timer; href: string; tone: string }[];
  if (!tiles.length) return null;
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href}>
          <Card className="flex items-center gap-4 px-5 py-4 transition hover:border-brand-200">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><t.icon className="h-4 w-4" /></div>
            <div>
              <div className="text-xs font-medium text-slate-500">{t.label}</div>
              <div className={`text-lg font-bold ${t.tone}`}>{t.value}</div>
              <div className="text-[11px] text-slate-400">{t.sub}</div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
