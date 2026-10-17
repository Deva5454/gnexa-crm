"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, ChevronDown, Loader2, Pause, Play, Plus, Trash2, Upload, X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { addChecklistItem, addTaskComment, deleteChecklistItem, deleteChecklistTemplate, recordTaskFile, saveChecklistTemplate, startTimer, stopTimer, toggleChecklistItem } from "../actions";
import { KeepValues } from "@/components/ui/keep-values";

const pad = (n: number) => String(n).padStart(2, "0");
function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Start/stop button with a live clock. `running` is the signed-in user's running timer (on any task). */
export function TimerControl({
  taskId,
  running,
  canTrack,
}: {
  taskId: number;
  running: { id: number; task_id: number; started_at: string; task_name: string } | null;
  canTrack: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const here = running?.task_id === taskId;
  useEffect(() => {
    if (!here) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [here]);

  if (!canTrack) return <p className="text-xs text-slate-400">Your role can&apos;t track time on tasks.</p>;

  return (
    <div className="space-y-3">
      {here ? (
        <>
          <div className="rounded-xl bg-ink-900 px-4 py-3 text-center">
            <div className="font-mono text-3xl font-bold tabular-nums tracking-tight text-white" suppressHydrationWarning>
              {now ? clock(now - new Date(running!.started_at).getTime()) : "--:--:--"}
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" /> Recording
            </div>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on? (optional)" aria-label="Timer note" className="field" maxLength={200} />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await stopTimer(running!.id, note || null);
                setMsg(r.error ?? `Logged ${r.hours} h.`);
                setNote("");
              })
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Stop timer
          </button>
        </>
      ) : (
        <>
          {running && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Your timer is running on <b>{running.task_name}</b>. Starting here stops that one and logs its time.
            </p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await startTimer(taskId);
                setMsg(r.error ?? null);
              })
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent-500 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start timer
          </button>
        </>
      )}
      {msg && <p className="text-center text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

type Item = { id: number; description: string; is_done: boolean; done_by_name: string | null };

export function Checklist({ taskId, items, canEdit, templates }: { taskId: number; items: Item[]; canEdit: boolean; templates: string[] }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const saved = new Set(templates);
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
    });
  const done = items.filter((i) => i.is_done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-accent-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600">{done}/{items.length}</span>
        </div>
      )}
      <ul className={cn("space-y-1", pending && "opacity-70")}>
        {items.map((i) => (
          <li key={i.id} className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={i.is_done}
              disabled={!canEdit || pending}
              onChange={() => start(() => toggleChecklistItem(i.id, !i.is_done))}
              aria-label={i.description}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-accent-500 focus:ring-accent-400"
            />
            <span className={cn("flex-1 text-sm text-slate-700", i.is_done && "text-slate-400 line-through")}>{i.description}</span>
            {i.is_done && i.done_by_name && <span className="hidden text-[11px] text-slate-400 sm:inline">{i.done_by_name.split(" ")[0]}</span>}
            {canEdit && !saved.has(i.description) && (
              <button
                type="button"
                onClick={() => run(() => saveChecklistTemplate(i.description))}
                className="rounded p-0.5 text-slate-300 opacity-0 hover:text-brand-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`Save "${i.description}" as a template`}
                title="Save as template"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => start(() => deleteChecklistItem(i.id))}
                className="rounded p-0.5 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`Delete ${i.description}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!items.length && <p className="text-sm text-slate-400">Break the task into steps.</p>}
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addChecklistItem(taskId, text);
              setError(r.error ?? null);
              if (!r.error) setText("");
            });
          }}
          className="flex gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item…" aria-label="New checklist item" className="field" maxLength={300} />
          <button disabled={pending || !text.trim()} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      )}
      {canEdit && templates.length > 0 && (
        <details className="group/tpl rounded-lg border border-slate-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Add from checklist templates ({templates.length})
            <ChevronDown className="h-3.5 w-3.5 transition group-open/tpl:rotate-180" />
          </summary>
          <ul className="max-h-56 overflow-y-auto border-t border-slate-100 py-1">
            {templates.map((d) => (
              <li key={d} className="flex items-center gap-1 px-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => addChecklistItem(taskId, d))}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{d}</span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteChecklistTemplate(d))}
                  className="rounded p-1 text-slate-300 hover:text-rose-600"
                  aria-label={`Remove template "${d}"`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function CommentBox({ taskId }: { taskId: number }) {
  const [state, action] = useActionState(addTaskComment, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="task_id" value={taskId} />
      <textarea name="body" required rows={3} placeholder="Write a comment — assignees and followers get notified" aria-label="Comment" className="field resize-y" />
      <KeepValues active={!!state?.error} />
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Posting…">Comment</SubmitButton>
      </div>
    </form>
  );
}

export function TaskFileUploader({ taskId }: { taskId: number }) {
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
      const path = `${taskId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("task-files").upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(`${file.name}: ${upErr.message}`);
        continue;
      }
      const res = await recordTaskFile({ task_id: taskId, name: file.name, path, size: file.size, mime: file.type || null });
      if (res?.error) setError(res.error);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : <Upload className="h-4 w-4 text-brand-500" />}
        <span><b className="text-slate-700">Attach files</b> · drag here or click · max 10 MB</span>
        <input ref={input} type="file" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
