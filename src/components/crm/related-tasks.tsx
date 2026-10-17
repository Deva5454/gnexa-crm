import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { taskPriority, taskStatus } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { todayIST } from "@/lib/dates";
import type { TaskRelType } from "@/lib/task-links";

/** Tasks linked to a record. `compact` suits a narrow sidebar (no priority or due-date columns). */
export async function RelatedTasks({ relType, relId, compact = false }: { relType: Exclude<TaskRelType, "project">; relId: number; compact?: boolean }) {
  const { supabase, can } = await requireStaff();
  if (!can("tasks", "view")) return null;
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, name, status, priority, due_date")
    .eq("rel_type", relType)
    .eq("rel_id", relId)
    .order("status")
    .order("due_date", { ascending: true, nullsFirst: false });

  const today = todayIST();
  return (
    <Card>
      <CardHeader
        title="Tasks"
        action={
          can("tasks", "edit") && (
            <LinkButton href={`/tasks/new?rel_type=${relType}&rel_id=${relId}`} size="sm" variant="secondary">
              <Plus className="h-3.5 w-3.5" /> Add task
            </LinkButton>
          )
        }
      />
      {!tasks?.length ? (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400">
          <ListChecks className="h-4 w-4" /> No tasks linked yet.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => {
            const s = taskStatus(t.status);
            const p = taskPriority(t.priority);
            const overdue = t.status !== "complete" && t.due_date && t.due_date < today;
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <Link href={`/tasks/${t.id}`} className={cn("min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-700", t.status === "complete" && "text-slate-400 line-through")}>
                  {t.name}
                </Link>
                {!compact && <span className={cn("text-xs font-medium", p.color)}>{p.label}</span>}
                {!compact && <span className={cn("hidden text-xs sm:inline", overdue ? "font-semibold text-rose-600" : "text-slate-500")}>{formatDate(t.due_date)}</span>}
                {compact && overdue && <span className="sr-only">Overdue</span>}
                <Badge className={s.color}>{s.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
