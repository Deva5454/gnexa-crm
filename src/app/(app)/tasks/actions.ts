"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { str } from "@/lib/utils";

export type FormState = { error?: string } | undefined;

function taskFields(form: FormData) {
  const status = str(form, "status");
  const priority = str(form, "priority");
  const rel = str(form, "rel"); // "customer:12" | "lead:5" | null
  const [relType, relId] = rel ? rel.split(":") : [null, null];
  return {
    name: str(form, "name") ?? "",
    description: str(form, "description"),
    status: (TASK_STATUSES.some((s) => s.value === status) ? status : "not_started") as Enums<"task_status">,
    priority: (TASK_PRIORITIES.some((p) => p.value === priority) ? priority : "medium") as Enums<"task_priority">,
    start_date: str(form, "start_date"),
    due_date: str(form, "due_date"),
    rel_type: (relType === "customer" || relType === "lead" ? relType : null) as "customer" | "lead" | null,
    rel_id: relType && relId ? Number(relId) : null,
  };
}

function relPath(t: { rel_type: string | null; rel_id: number | null }) {
  return t.rel_type && t.rel_id ? `/${t.rel_type}s/${t.rel_id}` : null;
}

export async function createTask(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const fields = taskFields(form);
  if (!fields.name) return { error: "Task name is required." };
  if (fields.start_date && fields.due_date && fields.due_date < fields.start_date)
    return { error: "Due date can't be before the start date." };

  const { data, error } = await supabase.from("tasks").insert(fields).select("id").single();
  if (error) return { error: error.message };
  const assignees = form.getAll("assignees").filter((v): v is string => typeof v === "string" && v !== "");
  if (assignees.length) await supabase.from("task_assignees").insert(assignees.map((staff_id) => ({ task_id: data.id, staff_id })));

  if (fields.rel_type && fields.rel_id)
    await logActivity(supabase, `added task "${fields.name}"`, { type: fields.rel_type, id: fields.rel_id });
  revalidatePath("/tasks");
  const back = relPath(fields);
  redirect(back ? `${back}${fields.rel_type === "customer" ? "?tab=tasks" : ""}` : "/tasks");
}

export async function updateTask(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const fields = taskFields(form);
  if (!fields.name) return { error: "Task name is required." };
  if (fields.start_date && fields.due_date && fields.due_date < fields.start_date)
    return { error: "Due date can't be before the start date." };

  const { error } = await supabase.from("tasks").update(fields).eq("id", id);
  if (error) return { error: error.message };
  const assignees = form.getAll("assignees").filter((v): v is string => typeof v === "string" && v !== "");
  await supabase.from("task_assignees").delete().eq("task_id", id);
  if (assignees.length) await supabase.from("task_assignees").insert(assignees.map((staff_id) => ({ task_id: id, staff_id })));
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return {};
}

export async function setTaskStatus(id: number, status: Enums<"task_status">) {
  const { supabase } = await assertAccess("tasks", "edit");
  const { data: t } = await supabase.from("tasks").update({ status }).eq("id", id).select("name, rel_type, rel_id").single();
  if (t && status === "complete" && (t.rel_type === "customer" || t.rel_type === "lead") && t.rel_id)
    await logActivity(supabase, `completed task "${t.name}"`, { type: t.rel_type, id: t.rel_id });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  const p = t ? relPath(t) : null;
  if (p) revalidatePath(p);
}

export async function deleteTask(form: FormData) {
  const { supabase } = await assertAccess("tasks", "full");
  const id = Number(str(form, "id"));
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
  redirect("/tasks");
}
