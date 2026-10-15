"use client";

import { useRef } from "react";
import { Field } from "@/components/ui/field";
import { TASK_PRIORITIES, TICKET_STATUSES } from "@/lib/constants";
import { updateTicket } from "../actions";

type Opt = { id: number; name: string };

/** Ticket properties that save as soon as a field changes. */
export function TicketProperties({
  ticket,
  departments,
  staff,
  projects,
  disabled,
}: {
  ticket: { id: number; status: string; priority: string; department_id: number | null; assigned_to: string | null; project_id: number | null };
  departments: Opt[];
  staff: { id: string; full_name: string }[];
  projects: Opt[];
  disabled: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const save = () => ref.current?.requestSubmit();
  return (
    <form ref={ref} action={updateTicket} className="space-y-3">
      <input type="hidden" name="id" value={ticket.id} />
      <Field label="Status">
        <select name="status" defaultValue={ticket.status} onChange={save} disabled={disabled} className="field">
          {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Priority">
        <select name="priority" defaultValue={ticket.priority} onChange={save} disabled={disabled} className="field">
          {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Assigned to">
        <select name="assigned_to" defaultValue={ticket.assigned_to ?? ""} onChange={save} disabled={disabled} className="field">
          <option value="">— Unassigned —</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </Field>
      <Field label="Department">
        <select name="department_id" defaultValue={ticket.department_id ?? ""} onChange={save} disabled={disabled} className="field">
          <option value="">—</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Project">
        <select name="project_id" defaultValue={ticket.project_id ?? ""} onChange={save} disabled={disabled} className="field">
          <option value="">—</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
    </form>
  );
}
