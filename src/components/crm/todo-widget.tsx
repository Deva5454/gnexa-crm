import Link from "next/link";
import { BellRing } from "lucide-react";
import { TodoList } from "@/app/(app)/todos/todo-list";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";

export async function TodoWidget({ className }: { className?: string }) {
  const { supabase, profile } = await requireStaff();
  const [{ data: todos }, { data: reminders }] = await Promise.all([
    supabase.from("todos").select("id, body, is_done").eq("staff_id", profile.id).order("is_done").order("position").limit(12),
    supabase.from("reminders").select("id, description, remind_at").eq("staff_id", profile.id).gt("remind_at", new Date().toISOString()).order("remind_at").limit(3),
  ]);
  return (
    <Card className={className}>
      <CardHeader title="My to-do" action={<Link href="/todos" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Open →</Link>} />
      <CardBody className="space-y-4">
        <TodoList todos={todos ?? []} compact />
        {(reminders ?? []).length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <div className="label">Coming up</div>
            <ul className="space-y-1.5">
              {reminders!.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-slate-700">{r.description}</span>
                  <span className="shrink-0 text-xs text-slate-400" suppressHydrationWarning>{formatDateTime(r.remind_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
