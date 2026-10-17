import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RelGroup } from "./task-form";
import { allRows } from "@/lib/fetch-all";
import { docNumber, type DocKind } from "@/lib/sales";
import { isTaskRelType, resolveTaskRels } from "@/lib/task-links";

export async function taskFormOptions(supabase: SupabaseClient<Database>) {
  const [{ data: staff }, { data: customers }, { data: leads }, { data: projects }, { data: milestones }, { data: tickets }, { data: contracts }, { data: docs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    allRows((a, b) => supabase.from("customers").select("id, company").eq("is_active", true).order("company").order("id").range(a, b)),
    supabase.from("leads").select("id, name, company").is("converted_customer_id", null).eq("is_junk", false).order("name").limit(500),
    supabase.from("projects").select("id, name").not("status", "in", "(cancelled,finished)").order("name").limit(500),
    supabase.from("milestones").select("id, name, project_id").order("position"),
    supabase.from("tickets").select("id, subject").neq("status", "closed").order("id", { ascending: false }).limit(300),
    supabase.from("contracts").select("id, subject").neq("status", "cancelled").order("id", { ascending: false }).limit(300),
    supabase.from("sales_docs").select("id, kind, number, status").not("status", "in", "(declined,cancelled)").order("id", { ascending: false }).limit(300),
  ]);
  const docsOf = (kind: DocKind) => (docs ?? []).filter((d) => d.kind === kind).map((d) => ({ value: `sales_doc:${d.id}`, label: docNumber(kind, d.number) }));
  const relGroups: RelGroup[] = [
    { label: "Customers", options: (customers ?? []).map((c) => ({ value: `customer:${c.id}`, label: c.company })) },
    { label: "Leads", options: (leads ?? []).map((l) => ({ value: `lead:${l.id}`, label: l.company ? `${l.name} · ${l.company}` : l.name })) },
    { label: "Projects", options: (projects ?? []).map((p) => ({ value: `project:${p.id}`, label: p.name })) },
    { label: "Support tickets", options: (tickets ?? []).map((t) => ({ value: `ticket:${t.id}`, label: `#${t.id} ${t.subject}` })) },
    { label: "Contracts", options: (contracts ?? []).map((c) => ({ value: `contract:${c.id}`, label: c.subject })) },
    { label: "Invoices", options: docsOf("invoice") },
    { label: "Estimates", options: docsOf("estimate") },
    { label: "Proposals", options: docsOf("proposal") },
  ];
  return {
    staff: staff ?? [],
    relGroups,
    milestones: (milestones ?? []).map((m) => ({ id: m.id, name: m.name, project: `project:${m.project_id}` })),
  };
}

/** Keep a link selectable even when its record isn't in the lists (closed ticket, paid invoice, converted lead…). */
export async function ensureRelOption(supabase: SupabaseClient<Database>, groups: RelGroup[], relType: string | null | undefined, relId: number | null | undefined) {
  if (!isTaskRelType(relType) || !relId) return;
  const value = `${relType}:${relId}`;
  if (groups.some((g) => g.options.some((o) => o.value === value))) return;
  const rel = (await resolveTaskRels(supabase, [{ rel_type: relType, rel_id: relId }]))({ rel_type: relType, rel_id: relId });
  if (rel) groups.unshift({ label: "Current link", options: [{ value, label: rel.label }] });
}
