import type { Enums } from "@/lib/database.types";

export const TASK_STATUSES: { value: Enums<"task_status">; label: string; color: string }[] = [
  { value: "not_started", label: "Not started", color: "bg-slate-100 text-slate-600 ring-slate-200" },
  { value: "in_progress", label: "In progress", color: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "testing", label: "Testing", color: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "awaiting_feedback", label: "Awaiting feedback", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "complete", label: "Complete", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
];

export const TASK_PRIORITIES: { value: Enums<"task_priority">; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-500" },
  { value: "medium", label: "Medium", color: "text-sky-600" },
  { value: "high", label: "High", color: "text-orange-600" },
  { value: "urgent", label: "Urgent", color: "text-rose-600" },
];

export const taskStatus = (v: string) => TASK_STATUSES.find((s) => s.value === v) ?? TASK_STATUSES[0]!;
export const taskPriority = (v: string) => TASK_PRIORITIES.find((p) => p.value === v) ?? TASK_PRIORITIES[1]!;

export const PROJECT_STATUSES = [
  { value: "not_started", label: "Not started", color: "bg-slate-100 text-slate-600 ring-slate-200" },
  { value: "in_progress", label: "In progress", color: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "on_hold", label: "On hold", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "finished", label: "Finished", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-slate-800 text-white ring-slate-800" },
] as const;
export const projectStatus = (v: string) => PROJECT_STATUSES.find((s) => s.value === v) ?? PROJECT_STATUSES[0];

export const TICKET_STATUSES = [
  { value: "open", label: "Open", color: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "in_progress", label: "In progress", color: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "answered", label: "Answered", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "on_hold", label: "On hold", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "closed", label: "Closed", color: "bg-slate-100 text-slate-500 ring-slate-200" },
] as const;
export const ticketStatus = (v: string) => TICKET_STATUSES.find((s) => s.value === v) ?? TICKET_STATUSES[0];
export const ticketNumber = (id: number) => `TKT-${String(id).padStart(5, "0")}`;
export const contractNumber = (id: number) => `CT-${String(id).padStart(5, "0")}`;

/** Contract state from status + dates. "Expiring" = signed and ends within 30 days. */
export function contractState(c: { status: string; start_date: string; end_date: string | null }, today = new Date().toISOString().slice(0, 10)) {
  if (c.status === "cancelled") return { key: "cancelled", label: "Cancelled", color: "bg-slate-800 text-white ring-slate-800" };
  if (c.status === "draft") return { key: "draft", label: "Draft", color: "bg-slate-100 text-slate-600 ring-slate-200" };
  if (c.status === "sent") return { key: "sent", label: "Awaiting signature", color: "bg-sky-50 text-sky-700 ring-sky-200" };
  if (c.end_date && c.end_date < today) return { key: "expired", label: "Expired", color: "bg-rose-50 text-rose-700 ring-rose-200" };
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  if (c.end_date && c.end_date <= soon) return { key: "expiring", label: "Expiring soon", color: "bg-amber-50 text-amber-700 ring-amber-200" };
  if (c.start_date > today) return { key: "upcoming", label: "Signed · starts soon", color: "bg-violet-50 text-violet-700 ring-violet-200" };
  return { key: "active", label: "Active", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
}
