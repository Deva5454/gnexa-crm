"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Field, FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/client";
import { addComment, addMilestone, logTime, recordFile, setProjectStatus } from "../actions";
import { PROJECT_STATUSES } from "@/lib/constants";
import { todayIST } from "@/lib/dates";

function useResetOnOk(state: { ok?: string } | undefined) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function StatusPicker({ id, status }: { id: number; status: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setProjectStatus}>
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} onChange={() => ref.current?.requestSubmit()} className="field h-8 py-1 text-xs" aria-label="Project status">
        {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </form>
  );
}

export function MilestoneForm({ projectId }: { projectId: number }) {
  const [state, action] = useActionState(addMilestone, undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-4">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="New milestone" className="min-w-[200px] flex-1"><input name="name" required className="field" /></Field>
      <Field label="Due"><input name="due_date" type="date" className="field" /></Field>
      <SubmitButton variant="secondary" pendingText="Adding…">Add</SubmitButton>
      <div className="w-full"><FormError message={state?.error} /></div>
    </form>
  );
}

export function TimeForm({ projectId, tasks, billableDefault }: { projectId: number; tasks: { id: number; name: string }[]; billableDefault: boolean }) {
  const [state, action] = useActionState(logTime, undefined);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="grid gap-3 p-4 sm:grid-cols-[1.4fr_140px_100px_1.4fr_auto_auto] sm:items-end">
      <input type="hidden" name="project_id" value={projectId} />
      <Field label="Task">
        <select name="task_id" className="field" defaultValue="">
          <option value="">General work</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
      <Field label="Date"><input name="date" type="date" defaultValue={todayIST()} className="field" /></Field>
      <Field label="Hours"><input name="hours" type="number" min="0.25" max="24" step="0.25" required className="field" /></Field>
      <Field label="Note"><input name="note" className="field" /></Field>
      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
        <input type="checkbox" name="is_billable" defaultChecked={billableDefault} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Billable
      </label>
      <SubmitButton pendingText="Logging…">Log time</SubmitButton>
      <div className="sm:col-span-6">
        <FormError message={state?.error} />
        {state?.ok && <p className="text-sm text-emerald-600">{state.ok}</p>}
      </div>
    </form>
  );
}

export function CommentForm({ projectId }: { projectId: number }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await addComment(fd);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <textarea name="body" required rows={3} placeholder="Share an update, ask a question, @mention a decision…" className="field" />
      <div className="flex justify-end"><SubmitButton size="sm" pendingText="Posting…">Post</SubmitButton></div>
    </form>
  );
}

/** Uploads straight to Supabase Storage from the browser, then records the file. */
export function FileUploader({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${projectId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("project-files").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`${file.name}: ${upErr.message}`);
        continue;
      }
      const res = await recordFile({ project_id: projectId, name: file.name, path, size: file.size, mime: file.type || null });
      if (res?.error) setError(res.error);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div className="p-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100"
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-brand-500" /> : <Upload className="h-6 w-6 text-brand-500" />}
        <span><b className="text-slate-700">Click to upload</b> or drag files here · max 10 MB each</span>
        <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
