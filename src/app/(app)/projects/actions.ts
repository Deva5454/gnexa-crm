"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { PROJECT_STATUSES } from "@/lib/constants";
import { docHref, docNumber } from "@/lib/sales";
import { discardUpload, fileRow } from "@/lib/uploads";
import { num, str } from "@/lib/utils";

export type FormState = { error?: string; ok?: string } | undefined;

const BUCKET = "project-files";
const path = (id: number, tab?: string) => `/projects/${id}${tab ? `?tab=${tab}` : ""}`;

// ───────────── Project ─────────────
export async function saveProject(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("projects", "edit")) return denied(roleName, "projects", "edit");
  const status = str(form, "status") ?? "not_started";
  const billing = str(form, "billing_type") === "hourly" ? "hourly" : "fixed";
  const fields = {
    name: str(form, "name") ?? "",
    customer_id: num(form, "customer_id") ?? 0,
    status: PROJECT_STATUSES.some((s) => s.value === status) ? status : "not_started",
    billing_type: billing,
    fixed_price: billing === "fixed" ? num(form, "fixed_price") : null,
    hourly_rate: billing === "hourly" ? num(form, "hourly_rate") : null,
    start_date: str(form, "start_date") ?? new Date().toISOString().slice(0, 10),
    deadline: str(form, "deadline"),
    description: str(form, "description"),
  };
  if (!fields.name) return { error: "Project name is required." };
  if (!fields.customer_id) return { error: "Choose a customer." };
  if (fields.deadline && fields.deadline < fields.start_date) return { error: "Deadline can't be before the start date." };
  if (billing === "hourly" && !(fields.hourly_rate && fields.hourly_rate > 0)) return { error: "Enter an hourly rate." };

  let projectId = id;
  if (id) {
    const { error } = await supabase.from("projects").update(fields).eq("id", id);
    if (error) return { error: error.message };
    await supabase.from("project_members").delete().eq("project_id", id);
  } else {
    const { data, error } = await supabase.from("projects").insert(fields).select("id").single();
    if (error) return { error: error.message };
    projectId = data.id;
    await logActivity(supabase, `created project "${fields.name}"`, { type: "customer", id: fields.customer_id });
  }
  const members = form.getAll("members").filter((v): v is string => typeof v === "string" && v !== "");
  if (members.length) await supabase.from("project_members").insert(members.map((staff_id) => ({ project_id: projectId!, staff_id })));
  revalidatePath("/projects");
  redirect(path(projectId!));
}

export async function setProjectStatus(form: FormData) {
  const { supabase } = await assertAccess("projects", "edit");
  const id = Number(str(form, "id"));
  const status = str(form, "status")!;
  if (!PROJECT_STATUSES.some((s) => s.value === status)) return;
  const { data } = await supabase.from("projects").update({ status }).eq("id", id).select("name").single();
  const label = PROJECT_STATUSES.find((s) => s.value === status)!.label.toLowerCase();
  if (data) await logActivity(supabase, `marked project "${data.name}" as ${label}`, { type: "project", id });
  revalidatePath(path(id));
  revalidatePath("/projects");
}

export async function deleteProject(form: FormData) {
  const { supabase } = await assertAccess("projects", "full");
  const id = Number(str(form, "id"));
  const { data: files } = await supabase.from("project_files").select("path").eq("project_id", id);
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map((f) => f.path));
  await supabase.from("tasks").delete().eq("rel_type", "project").eq("rel_id", id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect("/projects");
}

// ───────────── Milestones ─────────────
export async function addMilestone(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("projects", "edit")) return denied(roleName, "projects", "edit");
  const projectId = Number(str(form, "project_id"));
  const name = str(form, "name");
  if (!name) return { error: "Milestone name is required." };
  const { count } = await supabase.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", projectId);
  const { error } = await supabase.from("milestones").insert({ project_id: projectId, name, due_date: str(form, "due_date"), description: str(form, "description"), position: (count ?? 0) + 1 });
  if (error) return { error: error.message };
  revalidatePath(path(projectId, "milestones"));
  return { ok: "Milestone added." };
}

export async function toggleMilestone(form: FormData) {
  const { supabase } = await assertAccess("projects", "edit");
  const id = Number(str(form, "id"));
  const done = str(form, "done") === "1";
  const { data } = await supabase.from("milestones").update({ is_complete: done }).eq("id", id).select("project_id, name").single();
  if (data) {
    if (done) await logActivity(supabase, `completed milestone "${data.name}"`, { type: "project", id: data.project_id });
    revalidatePath(path(data.project_id));
  }
}

export async function deleteMilestone(form: FormData) {
  const { supabase } = await assertAccess("projects", "full");
  const { data } = await supabase.from("milestones").delete().eq("id", Number(str(form, "id"))).select("project_id").single();
  if (data) revalidatePath(path(data.project_id, "milestones"));
}

// ───────────── Timesheets ─────────────
export async function logTime(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("projects", "edit") && !can("tasks", "edit")) return denied(roleName, "projects", "edit");
  const projectId = Number(str(form, "project_id"));
  const hours = num(form, "hours");
  if (!hours || hours <= 0 || hours > 24) return { error: "Hours must be between 0 and 24." };
  const taskId = num(form, "task_id");
  if (taskId) {
    const { data: t } = await supabase.from("tasks").select("id").eq("id", taskId).eq("rel_type", "project").eq("rel_id", projectId).maybeSingle();
    if (!t) return { error: "That task isn't part of this project." };
  }
  const { error } = await supabase.from("timesheets").insert({
    project_id: projectId,
    task_id: taskId,
    date: str(form, "date") ?? new Date().toISOString().slice(0, 10),
    hours,
    note: str(form, "note"),
    is_billable: form.get("is_billable") === "on",
  });
  if (error) return { error: error.message };
  revalidatePath(path(projectId, "timesheets"));
  return { ok: `Logged ${hours} h.` };
}

export async function deleteTimesheet(form: FormData) {
  const { supabase, profile, can } = await requireStaff();
  const id = Number(str(form, "id"));
  const { data: row } = await supabase.from("timesheets").select("staff_id, project_id, invoice_id").eq("id", id).single();
  if (!row) return;
  if (row.invoice_id) throw new Error("This time has already been invoiced.");
  if (row.staff_id !== profile.id && !can("projects", "full")) throw new Error("You can only delete your own time entries.");
  await supabase.from("timesheets").delete().eq("id", id);
  revalidatePath(path(row.project_id, "timesheets"));
}

/** Raise a draft invoice: hourly → unbilled billable hours grouped by task; fixed → the fixed price. */
export async function invoiceProject(form: FormData) {
  await assertAccess("sales", "edit");
  const { supabase } = await assertAccess("projects", "edit");
  const id = Number(str(form, "id"));
  const { data: p } = await supabase.from("projects").select("name").eq("id", id).single();
  if (!p) throw new Error("Project not found.");
  // Claims the hours (or checks the fixed price wasn't billed) and creates the invoice in one transaction
  const { data: saved, error } = await supabase.rpc("invoice_project", { p_project: id });
  if (error) throw new Error(error.message);
  const inv = saved as { id: number; number: number };
  await logActivity(supabase, `invoiced project "${p.name}" on ${docNumber("invoice", inv.number)}`, { type: "project", id });
  revalidatePath(path(id));
  redirect(docHref("invoice", inv.id));
}

// ───────────── Discussion ─────────────
export async function addComment(form: FormData) {
  const { supabase } = await requireStaff();
  const projectId = Number(str(form, "project_id"));
  const body = str(form, "body");
  if (!body) return;
  await supabase.from("project_comments").insert({ project_id: projectId, body });
  revalidatePath(path(projectId, "discussion"));
}

export async function deleteComment(form: FormData) {
  const { supabase, profile } = await requireStaff();
  const id = Number(str(form, "id"));
  const { data } = await supabase.from("project_comments").select("created_by, project_id").eq("id", id).single();
  if (!data) return;
  if (data.created_by !== profile.id && !profile.is_admin) throw new Error("You can only delete your own comments.");
  await supabase.from("project_comments").delete().eq("id", id);
  revalidatePath(path(data.project_id, "discussion"));
}

// ───────────── Files (uploaded from the browser straight to storage) ─────────────
export async function recordFile(input: { project_id: number; name: string; path: string; size: number; mime: string | null }): Promise<{ error?: string }> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("projects", "edit")) return denied(roleName, "projects", "edit");
  const row = fileRow(input);
  if (!row || !row.path.startsWith(`${Number(input.project_id)}/`)) return { error: "Invalid file." };
  const { error } = await supabase.from("project_files").insert({ project_id: Number(input.project_id), ...row });
  if (error) {
    await discardUpload(supabase, BUCKET, "project_files", row.path);
    return { error: error.message };
  }
  await logActivity(supabase, `uploaded “${input.name}”`, { type: "project", id: input.project_id });
  revalidatePath(path(input.project_id, "files"));
  return {};
}

export async function deleteFile(form: FormData) {
  const { supabase } = await assertAccess("projects", "edit");
  const id = Number(str(form, "id"));
  // The uploader, or someone with full project access (enforced by the database)
  const { data } = await supabase.from("project_files").delete().eq("id", id).select("path, project_id").maybeSingle();
  if (!data) throw new Error("Only the uploader, or someone with full project access, can delete this file.");
  await supabase.storage.from(BUCKET).remove([data.path]);
  revalidatePath(path(data.project_id, "files"));
}
