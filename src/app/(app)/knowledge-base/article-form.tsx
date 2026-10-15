"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Tables } from "@/lib/database.types";
import type { FormState } from "./actions";

export function ArticleForm({
  action,
  article,
  groups,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  article?: Tables<"kb_articles">;
  groups: { id: number; name: string }[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const a = article;
  return (
    <form action={formAction} className="space-y-6">
      <FormError message={state?.error} />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Title *" htmlFor="title" className="sm:col-span-2"><input id="title" name="title" required defaultValue={a?.title} className="field text-base font-medium" /></Field>
          <Field label="Category" htmlFor="group_id">
            <select id="group_id" name="group_id" defaultValue={a?.group_id ?? groups[0]?.id ?? ""} className="field">
              <option value="">— Uncategorised —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="URL slug" htmlFor="slug" hint="Leave blank to generate from the title"><input id="slug" name="slug" defaultValue={a?.slug ?? ""} className="field font-mono text-xs" /></Field>
          <Field label="Article *" htmlFor="body" className="sm:col-span-2" hint="Plain text. Blank lines start new paragraphs; lines starting with • or 1. render as lists.">
            <textarea id="body" name="body" required rows={16} defaultValue={a?.body ?? ""} className="field leading-relaxed" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="is_published" defaultChecked={a?.is_published ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Published
          </label>
        </CardBody>
      </Card>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonClass({ variant: "secondary" })}>Cancel</Link>
        <SubmitButton pendingText="Saving…">{a ? "Save article" : "Publish article"}</SubmitButton>
      </div>
    </form>
  );
}
