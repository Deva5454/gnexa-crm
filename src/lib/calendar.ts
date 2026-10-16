import { contractNumber } from "@/lib/constants";
import { docHref, docNumber } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import type { requireStaff } from "@/lib/auth";

// Everything with a date across the CRM — shared by the Calendar page and the dashboard widget.

export type CalItem = { date: string; title: string; href: string; color: string; kind: string; time?: string; eventId?: number; mine?: boolean };

export const CAL_KIND = {
  event: { label: "Events", color: "#6d55f2" },
  task: { label: "Tasks due", color: "#0ea5e9" },
  invoice: { label: "Invoices due", color: "#e11d48" },
  project: { label: "Deadlines & milestones", color: "#0d9488" },
  contract: { label: "Contracts ending", color: "#f59e0b" },
} as const;

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const istDate = (ts: string) => new Date(new Date(ts).getTime() + 330 * 60_000).toISOString().slice(0, 10);
const istTime = (ts: string) => new Date(new Date(ts).getTime() + 330 * 60_000).toISOString().slice(11, 16);

/** Items dated between from and to (inclusive, YYYY-MM-DD), sorted by date, then time of day. */
export async function loadCalendarItems(ctx: Awaited<ReturnType<typeof requireStaff>>, from: string, to: string): Promise<CalItem[]> {
  const { supabase, can, profile } = ctx;
  const none = Promise.resolve({ data: null });
  const [{ data: events }, { data: tasks }, { data: invoices }, { data: projects }, { data: milestones }, { data: contracts }] = await Promise.all([
    supabase.from("calendar_events").select("id, title, starts_at, all_day, color, created_by").gte("starts_at", `${from}T00:00:00+05:30`).lte("starts_at", `${to}T23:59:59+05:30`),
    can("tasks", "view") ? supabase.from("tasks").select("id, name, due_date, priority").neq("status", "complete").gte("due_date", from).lte("due_date", to) : none,
    can("sales", "view") ? supabase.from("sales_docs").select("id, number, due_date, total, customer:customers(company)").eq("kind", "invoice").eq("status", "sent").gte("due_date", from).lte("due_date", to) : none,
    can("projects", "view") ? supabase.from("projects").select("id, name, deadline").not("status", "in", "(finished,cancelled)").gte("deadline", from).lte("deadline", to) : none,
    can("projects", "view") ? supabase.from("milestones").select("id, name, due_date, project_id, is_complete").eq("is_complete", false).gte("due_date", from).lte("due_date", to) : none,
    can("contracts", "view") ? supabase.from("contracts").select("id, subject, end_date").eq("status", "signed").gte("end_date", from).lte("end_date", to) : none,
  ]);
  const bals = invoices ? await balancesFor(supabase, invoices.map((i) => i.id)) : new Map();

  return ([
    ...(events ?? []).map((e) => ({ date: istDate(e.starts_at), title: e.title, href: "#", color: e.color, kind: "event", time: e.all_day ? undefined : istTime(e.starts_at), eventId: e.id, mine: e.created_by === profile.id || profile.is_admin })),
    ...(tasks ?? []).map((t) => ({ date: t.due_date!, title: t.name, href: `/tasks/${t.id}`, color: CAL_KIND.task.color, kind: "task" })),
    ...(invoices ?? []).filter((i) => (bals.get(i.id)?.balance ?? 1) > 0.005).map((i) => ({ date: i.due_date!, title: `${docNumber("invoice", i.number)} · ${i.customer?.company ?? ""}`, href: docHref("invoice", i.id), color: CAL_KIND.invoice.color, kind: "invoice" })),
    ...(projects ?? []).map((p) => ({ date: p.deadline!, title: `Deadline: ${p.name}`, href: `/projects/${p.id}`, color: CAL_KIND.project.color, kind: "project" })),
    ...(milestones ?? []).map((ms) => ({ date: ms.due_date!, title: `Milestone: ${ms.name}`, href: `/projects/${ms.project_id}?tab=milestones`, color: CAL_KIND.project.color, kind: "project" })),
    ...(contracts ?? []).map((c) => ({ date: c.end_date!, title: `${contractNumber(c.id)} ends: ${c.subject}`, href: `/contracts/${c.id}`, color: CAL_KIND.contract.color, kind: "contract" })),
  ] as CalItem[]).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "00:00").localeCompare(b.time ?? "00:00"));
}
