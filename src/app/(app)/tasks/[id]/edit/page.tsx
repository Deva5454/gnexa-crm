import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { deleteTask, updateTask } from "../../actions";
import { taskFormOptions } from "../../form-data";
import { TaskForm } from "../../task-form";

export const metadata: Metadata = { title: "Edit task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("tasks", "edit")) notFound();
  const [{ data: task }, { data: assignees }, opts] = await Promise.all([
    supabase.from("tasks").select("*, creator:profiles!tasks_created_by_fkey(full_name)").eq("id", id).maybeSingle(),
    supabase.from("task_assignees").select("staff_id").eq("task_id", id),
    taskFormOptions(supabase),
  ]);
  if (!task) notFound();

  // Keep the current link selectable even if it's a converted lead or inactive customer
  const rel = task.rel_type && task.rel_id ? `${task.rel_type}:${task.rel_id}` : null;
  if (rel && ![...opts.customers, ...opts.leads, ...opts.projects].some((o) => o.value === rel)) {
    const label =
      task.rel_type === "customer"
        ? (await supabase.from("customers").select("company").eq("id", task.rel_id!).maybeSingle()).data?.company
        : task.rel_type === "project"
          ? (await supabase.from("projects").select("name").eq("id", task.rel_id!).maybeSingle()).data?.name
          : (await supabase.from("leads").select("name").eq("id", task.rel_id!).maybeSingle()).data?.name;
    (task.rel_type === "customer" ? opts.customers : task.rel_type === "project" ? opts.projects : opts.leads).unshift({ value: rel, label: label ?? `#${task.rel_id}` });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={<Link href={`/tasks/${id}`} className="hover:text-brand-600">Task</Link>}
        title={`Edit: ${task.name}`}
        description={`Created by ${task.creator?.full_name ?? "someone"} · ${formatDateTime(task.created_at)}${task.completed_at ? ` · Completed ${formatDateTime(task.completed_at)}` : ""}`}
        actions={
          can("tasks", "full") && (
            <ConfirmForm action={deleteTask} message="Delete this task?">
              <input type="hidden" name="id" value={task.id} />
              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </ConfirmForm>
          )
        }
      />
      <TaskForm
        action={updateTask.bind(null, id)}
        task={task}
        assigneeIds={(assignees ?? []).map((a) => a.staff_id)}
        {...opts}
        cancelHref={`/tasks/${id}`}
      />
    </div>
  );
}
