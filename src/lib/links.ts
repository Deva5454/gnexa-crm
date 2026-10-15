import { KINDS } from "@/lib/sales";
import type { DocKind } from "@/lib/sales";

export const TAG_TYPES = ["customer", "lead", "task", "project", "ticket"] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const REMINDER_TYPES = ["customer", "lead", "project", "ticket", "contract", "sales_doc", "task", "expense"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

const BASE: Record<Exclude<ReminderType, "sales_doc">, string> = {
  customer: "/customers",
  lead: "/leads",
  project: "/projects",
  ticket: "/support",
  contract: "/contracts",
  task: "/tasks",
  expense: "/expenses",
};

/** Path to a record's page. Sales docs need their kind to build the URL. */
export function recordPath(type: ReminderType, id: number, kind?: DocKind) {
  if (type === "sales_doc") return kind ? `/sales/${KINDS[kind].slug}/${id}` : "/sales/invoices";
  return `${BASE[type]}/${id}`;
}

export const REL_LABEL: Record<ReminderType, string> = {
  customer: "Customer",
  lead: "Lead",
  project: "Project",
  ticket: "Ticket",
  contract: "Contract",
  sales_doc: "Document",
  task: "Task",
  expense: "Expense",
};
