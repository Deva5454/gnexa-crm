import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { createTask } from "../actions";
import { taskFormOptions } from "../form-data";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ rel_type?: string; rel_id?: string; milestone?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess("tasks", "edit", "/tasks");
  const opts = await taskFormOptions(supabase);
  const defaultRel = (sp.rel_type === "customer" || sp.rel_type === "lead" || sp.rel_type === "project") && sp.rel_id ? `${sp.rel_type}:${Number(sp.rel_id)}` : undefined;
  const cancelHref = defaultRel ? `/${sp.rel_type}s/${Number(sp.rel_id)}` : "/tasks";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New task" />
      <TaskForm action={createTask} {...opts} defaultRel={defaultRel} defaultMilestone={Number(sp.milestone) || undefined} defaultAssignee={profile.id} cancelHref={cancelHref} />
    </div>
  );
}
