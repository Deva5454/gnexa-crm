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
