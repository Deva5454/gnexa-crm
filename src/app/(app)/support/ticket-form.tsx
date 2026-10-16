"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TASK_PRIORITIES } from "@/lib/constants";
import { createTicket } from "./actions";

type Opt = { id: number; name: string };

export function TicketForm({
  customers,
  contacts,
  departments,
  projects,
  staff,
  defaultCustomer,
  defaultProject,
  currentUserId,
}: {
  customers: Opt[];
  contacts: (Opt & { customer_id: number })[];
  departments: Opt[];
  projects: (Opt & { customer_id: number })[];
  staff: { id: string; full_name: string }[];
  defaultCustomer?: number;
  defaultProject?: number;
  currentUserId: string;
}) {
  const [state, action] = useActionState(createTicket, undefined);
  const [customer, setCustomer] = useState<number | "">(defaultCustomer ?? "");
  const theirContacts = contacts.filter((c) => c.customer_id === customer);
  const theirProjects = projects.filter((p) => p.customer_id === customer);
  return (
    <form action={action} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject *" htmlFor="subject" className="sm:col-span-2"><input id="subject" name="subject" required className="field" /></Field>
          <Field label="Customer" htmlFor="customer_id">
            <select id="customer_id" name="customer_id" value={customer} onChange={(e) => setCustomer(e.target.value ? Number(e.target.value) : "")} className="field">
              <option value="">— None —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Contact" htmlFor="contact_id" hint={customer ? undefined : "Pick a customer first"}>
            <select key={customer} id="contact_id" name="contact_id" defaultValue={theirContacts[0]?.id ?? ""} disabled={!theirContacts.length} className="field">
              <option value="">—</option>
              {theirContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Department" htmlFor="department_id">
            <select id="department_id" name="department_id" defaultValue={departments[0]?.id ?? ""} className="field">
              <option value="">—</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <select id="priority" name="priority" defaultValue="medium" className="field">
              {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Assign to" htmlFor="assigned_to">
            <select id="assigned_to" name="assigned_to" defaultValue={currentUserId} className="field">
              <option value="">— Unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Project" htmlFor="project_id">
            <select key={`p${customer}`} id="project_id" name="project_id" defaultValue={theirProjects.some((p) => p.id === defaultProject) ? defaultProject : ""} disabled={!theirProjects.length} className="field">
              <option value="">—</option>
              {theirProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Message *" htmlFor="body" className="sm:col-span-2" hint="If a contact is chosen, this is recorded as their message.">
            <textarea id="body" name="body" required rows={6} className="field" />
          </Field>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href="/support" className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Opening…">Open ticket</SubmitButton>
      </div>
    </form>
  );
}
