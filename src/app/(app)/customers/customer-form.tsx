"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Tables } from "@/lib/database.types";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "./actions";

export function CustomerForm({
  action,
  customer,
  groups,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  customer?: Tables<"customers">;
  groups: Tables<"customer_groups">[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const c = customer;
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardHeader title="Company" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name *" htmlFor="company" className="sm:col-span-2">
            <input id="company" name="company" required defaultValue={c?.company} className="field" />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input id="phone" name="phone" defaultValue={c?.phone ?? ""} className="field" />
          </Field>
          <Field label="Website" htmlFor="website">
            <input id="website" name="website" placeholder="https://" defaultValue={c?.website ?? ""} className="field" />
          </Field>
          <Field label="GST / VAT number" htmlFor="vat">
            <input id="vat" name="vat" defaultValue={c?.vat ?? ""} className="field" />
          </Field>
          <Field label="Group" htmlFor="group_id">
            <select id="group_id" name="group_id" defaultValue={c?.group_id ?? ""} className="field">
              <option value="">— None —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Currency" htmlFor="currency" hint="Leave blank to use the company default">
            <input id="currency" name="currency" maxLength={3} placeholder="INR" defaultValue={c?.currency ?? ""} className="field uppercase" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Address" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Street address" htmlFor="address" className="sm:col-span-2">
            <textarea id="address" name="address" rows={2} defaultValue={c?.address ?? ""} className="field" />
          </Field>
          <Field label="City" htmlFor="city"><input id="city" name="city" defaultValue={c?.city ?? ""} className="field" /></Field>
          <Field label="State" htmlFor="state"><input id="state" name="state" defaultValue={c?.state ?? ""} className="field" /></Field>
          <Field label="Postal code" htmlFor="zip"><input id="zip" name="zip" defaultValue={c?.zip ?? ""} className="field" /></Field>
          <Field label="Country" htmlFor="country"><input id="country" name="country" defaultValue={c?.country ?? ""} className="field" /></Field>
        </CardBody>
      </Card>

      {!c && (
        <Card>
          <CardHeader title="Primary contact" description="Optional — you can add more contacts later" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="contact_first_name"><input id="contact_first_name" name="contact_first_name" className="field" /></Field>
            <Field label="Last name" htmlFor="contact_last_name"><input id="contact_last_name" name="contact_last_name" className="field" /></Field>
            <Field label="Email" htmlFor="contact_email"><input id="contact_email" name="contact_email" type="email" className="field" /></Field>
            <Field label="Phone" htmlFor="contact_phone"><input id="contact_phone" name="contact_phone" className="field" /></Field>
            <Field label="Position" htmlFor="contact_title"><input id="contact_title" name="contact_title" className="field" /></Field>
          </CardBody>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{c ? "Save changes" : "Create customer"}</SubmitButton>
      </div>
    </form>
  );
}
