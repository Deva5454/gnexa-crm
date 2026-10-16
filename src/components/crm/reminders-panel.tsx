import { BellRing, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { deleteReminder } from "@/lib/actions/reminders";
import { requireStaff } from "@/lib/auth";
import type { ReminderType } from "@/lib/links";
import { cn, formatDateTime } from "@/lib/utils";
import { ReminderForm } from "./reminder-form";

/** Reminders attached to one record — shown in a detail page's sidebar. */
export async function RemindersPanel({ relType, relId, path }: { relType: ReminderType; relId: number; path: string }) {
  const { supabase, profile } = await requireStaff();
  const [{ data: reminders }, { data: staff }] = await Promise.all([
    supabase
      .from("reminders")
      .select("id, description, remind_at, is_notified, staff_id, created_by, staff:profiles!reminders_staff_id_fkey(full_name)")
      .eq("rel_type", relType)
      .eq("rel_id", relId)
      .order("remind_at"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const now = Date.now();
  return (
    <Card>
      <CardHeader title="Reminders" description="Pops up in the bell at the set time" />
      <div className="space-y-3 p-4">
        {(reminders ?? []).length > 0 && (
          <ul className="space-y-2">
            {reminders!.map((r) => {
              const due = new Date(r.remind_at).getTime() <= now;
              const mine = r.staff_id === profile.id || r.created_by === profile.id || profile.is_admin;
              return (
                <li key={r.id} className={cn("group flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm", due ? "bg-slate-50 text-slate-500" : "bg-amber-50/70")}>
                  <BellRing className={cn("mt-0.5 h-4 w-4 shrink-0", due ? "text-slate-400" : "text-amber-500")} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-slate-800", due && "text-slate-500 line-through decoration-slate-300")}>{r.description}</div>
                    <div className="text-xs text-slate-500" suppressHydrationWarning>
                      {formatDateTime(r.remind_at)} · {r.staff_id === profile.id ? "you" : r.staff?.full_name}
                    </div>
                  </div>
                  {mine && (
                    <ConfirmForm action={deleteReminder} message="Delete this reminder?">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="path" value={path} />
                      <button className="rounded p-1 text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete reminder">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </ConfirmForm>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <ReminderForm relType={relType} relId={relId} path={path} staff={staff ?? []} meId={profile.id} />
      </div>
    </Card>
  );
}
