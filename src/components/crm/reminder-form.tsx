"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BellPlus } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { addReminder } from "@/lib/actions/reminders";
import type { ReminderType } from "@/lib/links";

export function ReminderForm({
  relType,
  relId,
  path,
  staff,
  meId,
}: {
  relType: ReminderType;
  relId: number;
  path: string;
  staff: { id: string; full_name: string }[];
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addReminder, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [tz, setTz] = useState("-330");
  const [tomorrow, setTomorrow] = useState("");
  useEffect(() => {
    setTz(String(new Date().getTimezoneOffset()));
    const d = new Date(Date.now() + 86400_000);
    setTomorrow(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, []);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700">
        <BellPlus className="h-3.5 w-3.5" /> Set a reminder
      </button>
    );

  return (
    <form ref={ref} action={action} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <input type="hidden" name="rel_type" value={relType} />
      <input type="hidden" name="rel_id" value={relId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="tz_offset" value={tz} />
      <input name="description" required placeholder="Remind me to…" className="field" autoFocus />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input type="date" name="date" required defaultValue={tomorrow} key={tomorrow} className="field" aria-label="Date" />
        <input type="time" name="time" defaultValue="10:00" className="field w-28" aria-label="Time" />
      </div>
      <select name="staff_id" defaultValue={meId} className="field" aria-label="Remind who">
        {staff.map((s) => (
          <option key={s.id} value={s.id}>{s.id === meId ? `Me (${s.full_name})` : s.full_name}</option>
        ))}
      </select>
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
        <SubmitButton size="sm" pendingText="Saving…">Save reminder</SubmitButton>
      </div>
    </form>
  );
}
