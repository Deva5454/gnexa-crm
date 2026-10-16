import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { clearDoneTodos } from "@/lib/actions/todos";
import { requireFeature, requireStaff } from "@/lib/auth";
import { recordPath, REL_LABEL, type ReminderType } from "@/lib/links";
import type { DocKind } from "@/lib/sales";
import { cn, formatDateTime } from "@/lib/utils";
import { TodoList } from "./todo-list";

export const metadata: Metadata = { title: "To-do" };

export default async function TodosPage() {
  await requireFeature("todos"); // Setup → Modules
  const { supabase, profile } = await requireStaff();
  const [{ data: todos }, { data: reminders }] = await Promise.all([
    supabase.from("todos").select("id, body, is_done").eq("staff_id", profile.id).order("is_done").order("position"),
    supabase.from("reminders").select("id, rel_type, rel_id, description, remind_at").eq("staff_id", profile.id).order("remind_at").limit(30),
  ]);
  const docIds = (reminders ?? []).filter((r) => r.rel_type === "sales_doc").map((r) => r.rel_id);
  const { data: docs } = docIds.length ? await supabase.from("sales_docs").select("id, kind").in("id", docIds) : { data: [] };
  const now = Date.now();
  const done = (todos ?? []).filter((t) => t.is_done).length;

  return (
    <>
      <PageHeader title="My to-do" description="Your private checklist, plus reminders you've been given." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader
            title="To-do"
            description={`${(todos?.length ?? 0) - done} open · ${done} done`}
            action={done > 0 ? <form action={clearDoneTodos}><button className="text-xs font-medium text-slate-500 hover:text-rose-600">Clear done</button></form> : undefined}
          />
          <CardBody>
            <TodoList todos={todos ?? []} />
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title="My reminders" description="Set from any customer, lead, task, ticket…" />
          <ul className="divide-y divide-slate-100">
            {(reminders ?? []).map((r) => {
              const due = new Date(r.remind_at).getTime() <= now;
              const kind = docs?.find((d) => d.id === r.rel_id)?.kind as DocKind | undefined;
              return (
                <li key={r.id}>
                  <Link href={recordPath(r.rel_type as ReminderType, r.rel_id, kind)} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                    <BellRing className={cn("mt-0.5 h-4 w-4 shrink-0", due ? "text-slate-300" : "text-amber-500")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-slate-800", due && "text-slate-400")}>{r.description}</span>
                      <span className="text-xs text-slate-400" suppressHydrationWarning>
                        {REL_LABEL[r.rel_type as ReminderType]} · {formatDateTime(r.remind_at)}{due ? " · done" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!reminders?.length && <li className="px-5 py-6 text-sm text-slate-400">No reminders yet. Use “Set a reminder” on any record.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
