import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { createTask } from "../actions";
import { ensureRelOption, taskFormOptions } from "../form-data";
import { isTaskRelType, resolveTaskRels } from "@/lib/task-links";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "New task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ rel_type?: string; rel_id?: string; milestone?: string; name?: string; description?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireAccess("tasks", "edit", "/tasks");
  const opts = await taskFormOptions(supabase);
  const relId = Number(sp.rel_id) || null;
  const relType = isTaskRelType(sp.rel_type) && relId ? sp.rel_type : null;
  const defaultRel = relType ? `${relType}:${relId}` : undefined;
  // Coming from a record: make sure it's in the list (a closed ticket, a paid invoice…) and go back there on cancel
  const back = relType ? (await resolveTaskRels(supabase, [{ rel_type: relType, rel_id: relId }]))({ rel_type: relType, rel_id: relId }) : null;
  if (relType) await ensureRelOption(supabase, opts.relGroups, relType, relId);
  const cancelHref = back?.href ?? "/tasks";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New task" />
      <TaskForm action={createTask} {...opts} defaultRel={defaultRel} defaultMilestone={Number(sp.milestone) || undefined} defaultAssignee={profile.id} defaultName={sp.name?.slice(0, 250)} defaultDescription={sp.description?.slice(0, 5000)} cancelHref={cancelHref} />
    </div>
  );
}
