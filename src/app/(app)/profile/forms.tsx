"use client";

import { useActionState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { changePassword, updateProfile } from "./actions";

function Ok({ text }: { text?: string }) {
  return text ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{text}</div> : null;
}

export function ProfileForm({ fullName, phone, jobTitle, email }: { fullName: string; phone: string; jobTitle: string; email: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <Card>
      <CardHeader title="Personal details" />
      <CardBody>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2"><FormError message={state?.error} /><Ok text={state?.ok} /></div>
          <Field label="Full name" htmlFor="full_name"><input id="full_name" name="full_name" defaultValue={fullName} required className="field" /></Field>
          <Field label="Email"><input value={email} disabled className="field" /></Field>
          <Field label="Phone" htmlFor="phone"><input id="phone" name="phone" defaultValue={phone} className="field" /></Field>
          <Field label="Job title" htmlFor="job_title"><input id="job_title" name="job_title" defaultValue={jobTitle} className="field" /></Field>
          <div className="flex justify-end sm:col-span-2"><SubmitButton pendingText="Saving…">Save</SubmitButton></div>
        </form>
      </CardBody>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <Card>
      <CardHeader title="Change password" />
      <CardBody>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2"><FormError message={state?.error} /><Ok text={state?.ok} /></div>
          <Field label="New password" htmlFor="password"><input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="field" /></Field>
          <Field label="Confirm" htmlFor="confirm"><input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" className="field" /></Field>
          <div className="flex justify-end sm:col-span-2"><SubmitButton variant="secondary" pendingText="Updating…">Update password</SubmitButton></div>
        </form>
      </CardBody>
    </Card>
  );
}
