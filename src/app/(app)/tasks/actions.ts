"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Enums } from "@/lib/database.types";
import { discardUpload, fileRow } from "@/lib/uploads";
import { str } from "@/lib/utils";
import { todayIST } from "@/lib/dates";
import { addInterval, type DocKind } from "@/lib/sales";
import { isTaskRelType, taskRelPath, type TaskRelType } from "@/lib/task-links";
import { friendlyError, must, withFlash } from "@/lib/flash";

export type FormState = { error?: string; ok?: string } | undefined;

const UNITS = ["day", "week", "month", "year"];

function taskFields(form: FormData) {
  const status = str(form, "status");
  const priority = str(form, "priority");
  const rel = str(form, "rel"); // "customer:12" | "ticket:5" | "sales_doc:3" | null
  const [relType, relId] = rel ? rel.split(":") : [null, null];
  const linked = isTaskRelType(relType) && Number(relId) > 0;
  const every = Math.trunc(Number(str(form, "recurring_every")));
  const unit = str(form, "recurring_unit") ?? "week";
  const repeats = every >= 1 && every <= 36;
  return {
    name: str(form, "name") ?? "",
    description: str(form, "description"),
    status: (TASK_STATUSES.some((s) => s.value === status) ? status : "not_started") as Enums<"task_status">,
    priority: (TASK_PRIORITIES.some((p) => p.value === priority) ? priority : "medium") as Enums<"task_priority">,
    start_date: str(form, "start_date"),
    due_date: str(form, "due_date"),
    rel_type: linked ? (relType as TaskRelType) : null,
    rel_id: linked ? Number(relId) : null,
    milestone_id: linked && relType === "project" ? (Number(str(form, "milestone_id")) || null) : null,
    // Only project tasks can reach the portal; anything else keeps the default
    visible_to_client: linked && relType === "project" ? form.get("visible_to_client") === "on" : true,
    recurring_every: repeats ? every : null,
    recurring_unit: UNITS.includes(unit) ? unit : "week",
    recurring_until: repeats ? str(form, "recurring_until") : null,
  };
}

type Fields = ReturnType<typeof taskFields>;

/** First repeat on or after today, counted from the start date (or today). Null when the task doesn't repeat or has run out. */
function nextRepeat(f: Fields) {
  if (!f.recurring_every) return null;
  const today = todayIST();
  const base = f.start_date ?? today;
  let d = addInterval(base, f.recurring_every, f.recurring_unit);
  for (let k = 2; d < today && k < 2000; k++) d = addInterval(base, f.recurring_every * k, f.recurring_unit);
  return f.recurring_until && d > f.recurring_until ? null : d;
}

function checkFields(f: Fields): string | null {
  if (!f.name) return "Task name is required.";
  if (f.start_date && f.due_date && f.due_date < f.start_date) return "Due date can't be before the start date.";
  if (f.recurring_until && f.start_date && f.recurring_until < f.start_date) return "The repeat end date can't be before the start date.";
  return null;
}

function relPath(t: { rel_type: string | null; rel_id: number | null }) {
  // Sales documents live under their kind's URL; everything else is /<type>s/<id>
  if (!t.rel_type || !t.rel_id || t.rel_type === "sales_doc") return null;
  return taskRelPath(t);
}

/** Records whose page has a Tasks tab (the others show tasks in a card). */
const TAB = new Set(["customer", "project"]);

export async function createTask(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const fields = taskFields(form);
  const problem = checkFields(fields);
  if (problem) return { error: problem };

  const { data, error } = await supabase.from("tasks").insert({ ...fields, next_recurring_date: nextRepeat(fields) }).select("id").single();
  if (error) return { error: friendlyError(error.message) };
  const assignees = form.getAll("assignees").filter((v): v is string => typeof v === "string" && v !== "");
  if (assignees.length) await supabase.from("task_assignees").insert(assignees.map((staff_id) => ({ task_id: data.id, staff_id })));

  if (fields.recurring_every) await supabase.rpc("run_recurring_tasks");

  if (fields.rel_type === "customer" || fields.rel_type === "lead" || fields.rel_type === "project")
    await logActivity(supabase, `added task "${fields.name}"`, { type: fields.rel_type, id: fields.rel_id! });
  revalidatePath("/tasks");
  // Back to the record the task belongs to
  const back = relPath(fields);
  if (back) redirect(TAB.has(fields.rel_type!) ? `${back}?tab=tasks` : back);
  if (fields.rel_type === "sales_doc") {
    const { data: d } = await supabase.from("sales_docs").select("kind").eq("id", fields.rel_id!).maybeSingle();
    if (d) redirect(taskRelPath(fields, d.kind as DocKind)!);
  }
  redirect("/tasks");
}

export async function updateTask(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const fields = taskFields(form);
  const problem = checkFields(fields);
  if (problem) return { error: problem };

  // Keep the schedule unless the repeat settings (or the start it counts from) changed
  const { data: before } = await supabase.from("tasks").select("start_date, recurring_every, recurring_unit, recurring_until, next_recurring_date").eq("id", id).maybeSingle();
  const same =
    before &&
    before.recurring_every === fields.recurring_every &&
    before.recurring_unit === fields.recurring_unit &&
    before.recurring_until === fields.recurring_until &&
    before.start_date === fields.start_date;
  const next = same ? before.next_recurring_date : nextRepeat(fields);

  const { error } = await supabase.from("tasks").update({ ...fields, next_recurring_date: next }).eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  const assignees = form.getAll("assignees").filter((v): v is string => typeof v === "string" && v !== "");
  await supabase.from("task_assignees").delete().eq("task_id", id);
  if (assignees.length) await supabase.from("task_assignees").insert(assignees.map((staff_id) => ({ task_id: id, staff_id })));
  if (fields.recurring_every) await supabase.rpc("run_recurring_tasks");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  redirect(`/tasks/${id}`);
}

export async function setTaskStatus(id: number, status: Enums<"task_status">) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("tasks", "edit");
    const { data: t } = await supabase.from("tasks").update({ status }).eq("id", id).select("name, rel_type, rel_id").single();
    if (t && status === "complete" && (t.rel_type === "customer" || t.rel_type === "lead" || t.rel_type === "project") && t.rel_id)
      await logActivity(supabase, `completed task "${t.name}"`, { type: t.rel_type, id: t.rel_id });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    const p = t ? relPath(t) : null;
    if (p) revalidatePath(p);
  });
}

export async function deleteTask(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("tasks", "full");
    const id = Number(str(form, "id"));
    const { data: files } = await supabase.from("task_files").select("path").eq("task_id", id);
    if (files?.length) await supabase.storage.from("task-files").remove(files.map((f) => f.path));
    must(await supabase.from("tasks").delete().eq("id", id));
    revalidatePath("/tasks");
    redirect("/tasks");
  });
}

/** Perfex "Copy task": same details, link, assignees and followers, a fresh checklist; never the comments, timers or files. */
export async function copyTask(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("tasks", "edit");
    const id = Number(str(form, "id"));
    const { data: t } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (!t) throw new Error("Task not found.");
    const copy = must(
      await supabase
        .from("tasks")
        .insert({
          name: `${t.name} (copy)`.slice(0, 250),
          description: t.description,
          priority: t.priority,
          start_date: todayIST(),
          due_date: t.due_date && t.start_date ? addInterval(todayIST(), Math.max(0, Math.round((Date.parse(t.due_date) - Date.parse(t.start_date)) / 86400000)), "day") : null,
          rel_type: t.rel_type,
          rel_id: t.rel_id,
          milestone_id: t.milestone_id,
          visible_to_client: t.visible_to_client,
        })
        .select("id")
        .single(),
    ).data!;
    const [{ data: as }, { data: fs }, { data: items }] = await Promise.all([
      supabase.from("task_assignees").select("staff_id").eq("task_id", id),
      supabase.from("task_followers").select("staff_id").eq("task_id", id),
      supabase.from("task_checklist_items").select("description, position").eq("task_id", id).order("position"),
    ]);
    if (as?.length) await supabase.from("task_assignees").insert(as.map((a) => ({ task_id: copy.id, staff_id: a.staff_id })));
    if (fs?.length) await supabase.from("task_followers").insert(fs.map((f) => ({ task_id: copy.id, staff_id: f.staff_id })));
    if (items?.length) await supabase.from("task_checklist_items").insert(items.map((i) => ({ task_id: copy.id, description: i.description, position: i.position })));
    revalidatePath("/tasks");
    redirect(`/tasks/${copy.id}/edit`);
  });
}

/** Bulk actions from the task list. */
export async function bulkTasks(form: FormData) {
  return withFlash(async () => {
    const op = str(form, "op") ?? "";
    const ids = [...new Set(form.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) throw new Error("Tick at least one task first.");
    const { supabase } = await assertAccess("tasks", op === "delete" ? "full" : "edit");
    const target = str(form, "target");
    switch (op) {
      case "status":
        if (!TASK_STATUSES.some((s) => s.value === target)) throw new Error("Pick a status.");
        must(await supabase.from("tasks").update({ status: target as Enums<"task_status"> }).in("id", ids));
        break;
      case "priority":
        if (!TASK_PRIORITIES.some((p) => p.value === target)) throw new Error("Pick a priority.");
        must(await supabase.from("tasks").update({ priority: target as Enums<"task_priority"> }).in("id", ids));
        break;
      case "assign":
        if (!target) throw new Error("Pick a staff member.");
        must(await supabase.from("task_assignees").upsert(ids.map((task_id) => ({ task_id, staff_id: target })), { ignoreDuplicates: true }));
        break;
      case "tag":
        if (!Number(target)) throw new Error("Pick a tag.");
        must(await supabase.from("taggables").upsert(ids.map((id) => ({ tag_id: Number(target), rel_type: "task", rel_id: id })), { ignoreDuplicates: true }));
        break;
      case "delete": {
        const { data: files } = await supabase.from("task_files").select("path").in("task_id", ids);
        if (files?.length) await supabase.storage.from("task-files").remove(files.map((f) => f.path));
        must(await supabase.from("tasks").delete().in("id", ids));
        break;
      }
      default:
        throw new Error("Pick an action.");
    }
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  });
}

// ───────────── Timer ─────────────
const taskPath = (id: number) => `/tasks/${id}`;

export async function startTimer(taskId: number): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("start_task_timer", { p_task: taskId });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(taskPath(taskId));
  revalidatePath("/tasks");
  return {};
}

export async function stopTimer(timerId: number, note: string | null): Promise<{ error?: string; hours?: number }> {
  const { supabase } = await requireStaff();
  const { data: t } = await supabase.from("task_timers").select("task_id").eq("id", timerId).maybeSingle();
  const { data, error } = await supabase.rpc("stop_task_timer", { p_timer: timerId, p_note: note });
  if (error) return { error: friendlyError(error.message) };
  if (t) {
    revalidatePath(taskPath(t.task_id));
    const { data: task } = await supabase.from("tasks").select("rel_type, rel_id").eq("id", t.task_id).single();
    if (task?.rel_type === "project" && task.rel_id) revalidatePath(`/projects/${task.rel_id}`);
  }
  revalidatePath("/tasks");
  return { hours: Number(data) };
}

export async function deleteTimer(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireStaff();
    const id = Number(str(form, "id"));
    const { data } = await supabase.from("task_timers").delete().eq("id", id).select("task_id").maybeSingle();
    if (data) revalidatePath(taskPath(data.task_id));
  });
}

// ───────────── Checklist ─────────────
export async function addChecklistItem(taskId: number, description: string): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const text = description.trim().slice(0, 300);
  if (!text) return { error: "Write the item first." };
  const { error } = await supabase.from("task_checklist_items").insert({ task_id: taskId, description: text });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath(taskPath(taskId));
  return {};
}

export async function toggleChecklistItem(id: number, done: boolean) {
  return withFlash(async () => {
    const { supabase, profile } = await assertAccess("tasks", "edit");
    const { data } = await supabase
      .from("task_checklist_items")
      .update({ is_done: done, done_by: done ? profile.id : null, done_at: done ? new Date().toISOString() : null })
      .eq("id", id)
      .select("task_id")
      .single();
    if (data) revalidatePath(taskPath(data.task_id));
  });
}

export async function deleteChecklistItem(id: number) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("tasks", "edit");
    const { data } = await supabase.from("task_checklist_items").delete().eq("id", id).select("task_id").single();
    if (data) revalidatePath(taskPath(data.task_id));
  });
}

// ───────────── Checklist templates (saved items anyone can drop into a task) ─────────────
export async function saveChecklistTemplate(description: string): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const text = description.trim().slice(0, 300);
  if (!text) return { error: "Nothing to save." };
  const { error } = await supabase.from("checklist_templates").upsert({ description: text }, { onConflict: "description", ignoreDuplicates: true });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/tasks", "layout");
  return {};
}

export async function deleteChecklistTemplate(description: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("checklist_templates").delete().eq("description", description).select("id");
  if (!data?.length) return { error: "Only whoever saved it, or someone with full task access, can remove this template." };
  revalidatePath("/tasks", "layout");
  return {};
}

// ───────────── Comments ─────────────
export async function addTaskComment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, profile } = await requireStaff();
  const taskId = Number(str(form, "task_id"));
  const body = str(form, "body");
  if (!body) return { error: "Write a comment first." };
  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, body });
  if (error) return { error: friendlyError(error.message) };
  // Commenting on a task you're not on means you want to hear back: follow it
  const { data: on } = await supabase.from("task_assignees").select("task_id").eq("task_id", taskId).eq("staff_id", profile.id).maybeSingle();
  if (!on) await supabase.from("task_followers").upsert({ task_id: taskId, staff_id: profile.id }, { ignoreDuplicates: true });
  revalidatePath(taskPath(taskId));
  return {};
}

export async function deleteTaskComment(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    const id = Number(str(form, "id"));
    const { data } = await supabase.from("task_comments").select("created_by, task_id").eq("id", id).single();
    if (!data) return;
    if (data.created_by !== profile.id && !profile.is_admin) throw new Error("You can only delete your own comments.");
    must(await supabase.from("task_comments").delete().eq("id", id));
    revalidatePath(taskPath(data.task_id));
  });
}

// ───────────── Followers ─────────────
export async function toggleFollow(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireStaff();
    const taskId = Number(str(form, "task_id"));
    if (str(form, "follow") === "1") must(await supabase.from("task_followers").upsert({ task_id: taskId, staff_id: profile.id }, { ignoreDuplicates: true }));
    else await supabase.from("task_followers").delete().eq("task_id", taskId).eq("staff_id", profile.id);
    revalidatePath(taskPath(taskId));
  });
}

// ───────────── Attachments (uploaded from the browser straight to storage) ─────────────
const TASK_BUCKET = "task-files";

export async function recordTaskFile(input: { task_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("tasks", "edit")) return denied(roleName, "tasks", "edit");
  const row = fileRow(input);
  if (!row || !row.path.startsWith(`${Number(input.task_id)}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("task_files").insert({ task_id: Number(input.task_id), ...row });
  if (error) {
    await discardUpload(supabase, TASK_BUCKET, "task_files", row.path);
    return { error: friendlyError(error.message) };
  }
  revalidatePath(taskPath(input.task_id));
  return {};
}

export async function deleteTaskFile(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await assertAccess("tasks", "edit");
    const { data } = await supabase.from("task_files").delete().eq("id", Number(str(form, "id"))).select("path, task_id").maybeSingle();
    if (!data) throw new Error("Only the uploader, or someone with full task access, can delete this file.");
    await supabase.storage.from(TASK_BUCKET).remove([data.path]);
    revalidatePath(taskPath(data.task_id));
  });
}
