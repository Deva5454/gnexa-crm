"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { str } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

function taskFields(form: FormData) {
  const status = str(form, "status");
  const priority = str(form, "priority");
  const rel = str(form, "rel"); // "customer:12" | "lead:5" | "project:3" | null
  const [relType, relId] = rel ? rel.split(":") : [null, null];
  return {
    name: str(form, "name") ?? "",
    description: str(form, "description"),
    status: (TASK_STATUSES.some((s) => s.value === status) ? status : "not_started") as Enums<"task_status">,
    priority: (TASK_PRIORITIES.some((p) => p.value === priority) ? priority : "medium") as Enums<"task_priority">,
    start_date: str(form, "start_date"),
    due_date: str(form, "due_date"),
    rel_type: (relType === "customer" || relType === "lead" || relType === "project" ? relType : null) as "customer" | "lead" | "project" | null,
    rel_id: relType && relId ? Number(relId) : null,
    milestone_id: relType === "project" ? (Number(str(form, "milestone_id")) || null) : null,
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
  redirect(back ? `${back}${fields.rel_type !== "lead" ? "?tab=tasks" : ""}` : "/tasks");
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
  redirect(`/tasks/${id}`);
}

export async function setTaskStatus(id: number, status: Enums<"task_status">) {
  const { supabase } = await assertAccess("tasks", "edit");
  const { data: t } = await supabase.from("tasks").update({ status }).eq("id", id).select("name, rel_type, rel_id").single();
  if (t && status === "complete" && (t.rel_type === "customer" || t.rel_type === "lead" || t.rel_type === "project") && t.rel_id)
    await logActivity(supabase, `completed task "${t.name}"`, { type: t.rel_type, id: t.rel_id });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  const p = t ? relPath(t) : null;
  if (p) revalidatePath(p);
}

export async function deleteTask(form: FormData) {
  const { supabase } = await assertAccess("tasks", "full");
  const id = Number(str(form, "id"));
  const { data: files } = await supabase.from("task_files").select("path").eq("task_id", id);
  if (files?.length) await supabase.storage.from("task-files").remove(files.map((f) => f.path));
  await supabase.from("tasks").delete().eq("id", id);
  revalidatePath("/tasks");
  redirect("/tasks");
}

// ───────────── Timer ─────────────
const taskPath = (id: number) => `/tasks/${id}`;

export async function startTimer(taskId: number): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("start_task_timer", { p_task: taskId });
  if (error) return { error: error.message };
  revalidatePath(taskPath(taskId));
  revalidatePath("/tasks");
  return {};
}

export async function stopTimer(timerId: number, note: string | null): Promise<{ error?: string; hours?: number }> {
  const { supabase } = await requireStaff();
  const { data: t } = await supabase.from("task_timers").select("task_id").eq("id", timerId).maybeSingle();
  const { data, error } = await supabase.rpc("stop_task_timer", { p_timer: timerId, p_note: note });
  if (error) return { error: error.message };
  if (t) {
    revalidatePath(taskPath(t.task_id));
    const { data: task } = await supabase.from("tasks").select("rel_type, rel_id").eq("id", t.task_id).single();
    if (task?.rel_type === "project" && task.rel_id) revalidatePath(`/projects/${task.rel_id}`);
  }
  revalidatePath("/tasks");
  return { hours: Number(data) };
}

export async function deleteTimer(form: FormData) {
  const { supabase } = await requireStaff();
  const id = Number(str(form, "id"));
  const { data } = await supabase.from("task_timers").delete().eq("id", id).select("task_id").maybeSingle();
  if (data) revalidatePath(taskPath(data.task_id));
}

// ───────────── Checklist ─────────────
export async function addChecklistItem(taskId: number, description: string): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const text = description.trim().slice(0, 300);
  if (!text) return { error: "Write the item first." };
  const { error } = await supabase.from("task_checklist_items").insert({ task_id: taskId, description: text });
  if (error) return { error: error.message };
  revalidatePath(taskPath(taskId));
  return {};
}

export async function toggleChecklistItem(id: number, done: boolean) {
  const { supabase, profile } = await assertAccess("tasks", "edit");
  const { data } = await supabase
    .from("task_checklist_items")
    .update({ is_done: done, done_by: done ? profile.id : null, done_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select("task_id")
    .single();
  if (data) revalidatePath(taskPath(data.task_id));
}

export async function deleteChecklistItem(id: number) {
  const { supabase } = await assertAccess("tasks", "edit");
  const { data } = await supabase.from("task_checklist_items").delete().eq("id", id).select("task_id").single();
  if (data) revalidatePath(taskPath(data.task_id));
}

// ───────────── Comments ─────────────
export async function addTaskComment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await requireStaff();
  const taskId = Number(str(form, "task_id"));
  const body = str(form, "body");
  if (!body) return { error: "Write a comment first." };
  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, body });
  if (error) return { error: error.message };
  // Commenting on a task you're not on means you want to hear back: follow it
  const { data: on } = await supabase.from("task_assignees").select("task_id").eq("task_id", taskId).eq("staff_id", profile.id).maybeSingle();
  if (!on) await supabase.from("task_followers").upsert({ task_id: taskId, staff_id: profile.id }, { ignoreDuplicates: true });
  revalidatePath(taskPath(taskId));
  return {};
}

export async function deleteTaskComment(form: FormData) {
  const { supabase, profile } = await requireStaff();
  const id = Number(str(form, "id"));
  const { data } = await supabase.from("task_comments").select("created_by, task_id").eq("id", id).single();
  if (!data) return;
  if (data.created_by !== profile.id && !profile.is_admin) throw new Error("You can only delete your own comments.");
  await supabase.from("task_comments").delete().eq("id", id);
  revalidatePath(taskPath(data.task_id));
}

// ───────────── Followers ─────────────
export async function toggleFollow(form: FormData) {
  const { supabase, profile } = await requireStaff();
  const taskId = Number(str(form, "task_id"));
  if (str(form, "follow") === "1") await supabase.from("task_followers").upsert({ task_id: taskId, staff_id: profile.id }, { ignoreDuplicates: true });
  else await supabase.from("task_followers").delete().eq("task_id", taskId).eq("staff_id", profile.id);
  revalidatePath(taskPath(taskId));
}

// ───────────── Attachments (uploaded from the browser straight to storage) ─────────────
const TASK_BUCKET = "task-files";

export async function recordTaskFile(input: { task_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  if (!input.path.startsWith(`${input.task_id}/`)) return { error: "Invalid file path." };
  const { error } = await supabase.from("task_files").insert(input);
  if (error) {
    await supabase.storage.from(TASK_BUCKET).remove([input.path]);
    return { error: error.message };
  }
  revalidatePath(taskPath(input.task_id));
  return {};
}

export async function deleteTaskFile(form: FormData) {
  const { supabase } = await assertAccess("tasks", "edit");
  const { data } = await supabase.from("task_files").delete().eq("id", Number(str(form, "id"))).select("path, task_id").single();
  if (data) {
    await supabase.storage.from(TASK_BUCKET).remove([data.path]);
    revalidatePath(taskPath(data.task_id));
  }
}
