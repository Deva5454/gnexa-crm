import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { docHref, docNumber, KINDS, type DocKind } from "@/lib/sales";

/** What a task can be linked to (Perfex "Related to"). */
export const TASK_REL_TYPES = ["customer", "lead", "project", "ticket", "contract", "sales_doc"] as const;
export type TaskRelType = (typeof TASK_REL_TYPES)[number];
export const isTaskRelType = (v: unknown): v is TaskRelType => TASK_REL_TYPES.includes(v as TaskRelType);

export const TASK_REL_LABELS: Record<TaskRelType, string> = {
  customer: "Customer",
  lead: "Lead",
  project: "Project",
  ticket: "Ticket",
  contract: "Contract",
  sales_doc: "Invoice / estimate / proposal",
};

export type TaskRel = { label: string; href: string; kind: string };

type Db = SupabaseClient<Database>;
type Row = { rel_type: string | null; rel_id: number | null };

/** Page of the linked record — the record's own Tasks tab where it has one. */
export function taskRelPath(t: Row, docKind?: DocKind): string | null {
  if (!t.rel_type || !t.rel_id) return null;
  switch (t.rel_type) {
    case "customer": return `/customers/${t.rel_id}`;
    case "lead": return `/leads/${t.rel_id}`;
    case "project": return `/projects/${t.rel_id}`;
    case "ticket": return `/support/${t.rel_id}`;
    case "contract": return `/contracts/${t.rel_id}`;
    case "sales_doc": return docKind ? docHref(docKind, t.rel_id) : null;
    default: return null;
  }
}

/** Names and links for the records a set of tasks point at, in one query per record type. */
export async function resolveTaskRels(supabase: Db, rows: Row[]): Promise<(t: Row) => TaskRel | null> {
  const ids = (type: TaskRelType) => [...new Set(rows.filter((t) => t.rel_type === type && t.rel_id).map((t) => t.rel_id!))];
  const none = Promise.resolve({ data: [] as never[] });
  const [c, l, p, tk, ct, sd] = [ids("customer"), ids("lead"), ids("project"), ids("ticket"), ids("contract"), ids("sales_doc")];
  const [{ data: custs }, { data: leads }, { data: projs }, { data: tickets }, { data: contracts }, { data: docs }] = await Promise.all([
    c.length ? supabase.from("customers").select("id, company").in("id", c) : none,
    l.length ? supabase.from("leads").select("id, name").in("id", l) : none,
    p.length ? supabase.from("projects").select("id, name").in("id", p) : none,
    tk.length ? supabase.from("tickets").select("id, subject").in("id", tk) : none,
    ct.length ? supabase.from("contracts").select("id, subject").in("id", ct) : none,
    sd.length ? supabase.from("sales_docs").select("id, kind, number").in("id", sd) : none,
  ]);
  const map = new Map<string, TaskRel>();
  for (const x of custs ?? []) map.set(`customer:${x.id}`, { label: x.company, href: `/customers/${x.id}`, kind: "customer" });
  for (const x of leads ?? []) map.set(`lead:${x.id}`, { label: x.name, href: `/leads/${x.id}`, kind: "lead" });
  for (const x of projs ?? []) map.set(`project:${x.id}`, { label: x.name, href: `/projects/${x.id}`, kind: "project" });
  for (const x of tickets ?? []) map.set(`ticket:${x.id}`, { label: `#${x.id} ${x.subject}`, href: `/support/${x.id}`, kind: "ticket" });
  for (const x of contracts ?? []) map.set(`contract:${x.id}`, { label: x.subject, href: `/contracts/${x.id}`, kind: "contract" });
  for (const x of docs ?? []) {
    const kind = x.kind as DocKind;
    map.set(`sales_doc:${x.id}`, { label: docNumber(kind, x.number), href: docHref(kind, x.id), kind: KINDS[kind].label.toLowerCase() });
  }
  return (t) => (t.rel_type && t.rel_id ? (map.get(`${t.rel_type}:${t.rel_id}`) ?? null) : null);
}
