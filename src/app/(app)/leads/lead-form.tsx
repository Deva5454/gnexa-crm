"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Tables } from "@/lib/database.types";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "./actions";

export function LeadForm({
  action,
  lead,
  statuses,
  sources,
  staff,
  currentUserId,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  lead?: Tables<"leads">;
  statuses: Pick<Tables<"lead_statuses">, "id" | "name">[];
  sources: Pick<Tables<"lead_sources">, "id" | "name">[];
  staff: Pick<Tables<"profiles">, "id" | "full_name">[];
  currentUserId: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const l = lead;
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardHeader title="Pipeline" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status" htmlFor="status_id">
            <select id="status_id" name="status_id" defaultValue={l?.status_id ?? statuses[0]?.id} className="field">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Source" htmlFor="source_id">
            <select id="source_id" name="source_id" defaultValue={l?.source_id ?? ""} className="field">
              <option value="">— None —</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Assigned to" htmlFor="assigned_to">
            <select id="assigned_to" name="assigned_to" defaultValue={l ? (l.assigned_to ?? "") : currentUserId} className="field">
              <option value="">— Unassigned —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Deal value" htmlFor="value">
            <input id="value" name="value" type="number" min="0" step="0.01" defaultValue={l?.value ?? ""} className="field" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lead details" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name *" htmlFor="name"><input id="name" name="name" required defaultValue={l?.name} className="field" /></Field>
          <Field label="Position" htmlFor="title"><input id="title" name="title" defaultValue={l?.title ?? ""} className="field" /></Field>
          <Field label="Company" htmlFor="company"><input id="company" name="company" defaultValue={l?.company ?? ""} className="field" /></Field>
          <Field label="Website" htmlFor="website"><input id="website" name="website" defaultValue={l?.website ?? ""} className="field" /></Field>
          <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" defaultValue={l?.email ?? ""} className="field" /></Field>
          <Field label="Phone" htmlFor="phone"><input id="phone" name="phone" defaultValue={l?.phone ?? ""} className="field" /></Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2"><input id="address" name="address" defaultValue={l?.address ?? ""} className="field" /></Field>
          <Field label="City" htmlFor="city"><input id="city" name="city" defaultValue={l?.city ?? ""} className="field" /></Field>
          <Field label="Country" htmlFor="country"><input id="country" name="country" defaultValue={l?.country ?? ""} className="field" /></Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2">
            <textarea id="description" name="description" rows={4} defaultValue={l?.description ?? ""} className="field" />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{l ? "Save changes" : "Create lead"}</SubmitButton>
      </div>
    </form>
  );
}
