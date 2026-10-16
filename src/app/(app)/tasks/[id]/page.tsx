import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, BellOff, CalendarDays, Clock, Download, Flag, Link2, Milestone, Paperclip, Pencil, Trash2, User } from "lucide-react";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import { RecordTags } from "@/components/crm/tags";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { taskPriority } from "@/lib/constants";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import { deleteTask, deleteTaskComment, deleteTaskFile, deleteTimer, toggleFollow } from "../actions";
import { StatusSelect } from "../status-select";
import { Checklist, CommentBox, TaskFileUploader, TimerControl } from "./panels";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "Task" };

const hrs = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can, profile } = await requireStaff();
  if (!can("tasks", "view")) notFound();
  const [{ data: t }, { data: assignees }, { data: followers }, { data: items }, { data: comments }, { data: files }, { data: timers }, { data: mine }, { data: sheet }] = await Promise.all([
    supabase.from("tasks").select("*, creator:profiles!tasks_created_by_fkey(full_name), milestone:milestones(name)").eq("id", id).maybeSingle(),
    supabase.from("task_assignees").select("staff_id, staff:profiles(full_name, job_title)").eq("task_id", id),
    supabase.from("task_followers").select("staff_id, staff:profiles(full_name)").eq("task_id", id),
    supabase.from("task_checklist_items").select("id, description, is_done, done_by_profile:profiles!task_checklist_items_done_by_fkey(full_name)").eq("task_id", id).order("position"),
    supabase.from("task_comments").select("id, body, created_at, created_by, author:profiles!task_comments_created_by_fkey(full_name)").eq("task_id", id).order("created_at"),
    supabase.from("task_files").select("id, name, size, created_at, uploader:profiles!task_files_uploaded_by_fkey(full_name)").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("task_timers").select("id, staff_id, started_at, ended_at, note, timesheet_id, staff:profiles!task_timers_staff_id_fkey(full_name)").eq("task_id", id).order("started_at", { ascending: false }),
    supabase.from("task_timers").select("id, task_id, started_at, task:tasks(name)").eq("staff_id", profile.id).is("ended_at", null).maybeSingle(),
    supabase.from("timesheets").select("hours, staff_id").eq("task_id", id),
  ]);
  if (!t) notFound();

  // What the task belongs to
  let rel: { label: string; href: string; kind: string } | null = null;
  if (t.rel_type && t.rel_id) {
    const name =
      t.rel_type === "customer"
        ? (await supabase.from("customers").select("company").eq("id", t.rel_id).maybeSingle()).data?.company
        : t.rel_type === "project"
          ? (await supabase.from("projects").select("name").eq("id", t.rel_id).maybeSingle()).data?.name
          : (await supabase.from("leads").select("name").eq("id", t.rel_id).maybeSingle()).data?.name;
    rel = { label: name ?? `#${t.rel_id}`, href: `/${t.rel_type}s/${t.rel_id}`, kind: t.rel_type };
  }

  const now = Date.now();
  // Project timesheet hours for this task + timer time that didn't go to a timesheet (non-project tasks, or still running)
  const loose = (timers ?? []).filter((x) => !x.timesheet_id);
  const span = (x: { started_at: string; ended_at: string | null }) => (x.ended_at ? new Date(x.ended_at).getTime() : now) - new Date(x.started_at).getTime();
  const sheetHrs = (sheet ?? []).reduce((s, x) => s + Number(x.hours), 0);
  const total = Math.round((sheetHrs + hrs(loose.reduce((s, x) => s + span(x), 0))) * 100) / 100;
  const myTotal = Math.round(((sheet ?? []).filter((x) => x.staff_id === profile.id).reduce((s, x) => s + Number(x.hours), 0) + hrs(loose.filter((x) => x.staff_id === profile.id && x.ended_at).reduce((s, x) => s + span(x), 0))) * 100) / 100;
  const canEdit = can("tasks", "edit");
  const following = (followers ?? []).some((f) => f.staff_id === profile.id);
  const assigned = (assignees ?? []).some((a) => a.staff_id === profile.id);
  const pr = taskPriority(t.priority);
  const today = todayIST();
  const late = t.status !== "complete" && t.due_date && t.due_date < today;
  const path = `/tasks/${id}`;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/tasks" className="hover:text-brand-600">Tasks</Link>}
        title={<span className={cn(t.status === "complete" && "text-slate-500 line-through decoration-slate-300")}>{t.name}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {canEdit ? <StatusSelect id={id} status={t.status} /> : null}
            <span className={cn("inline-flex items-center gap-1 font-semibold", pr.color)}><Flag className="h-3.5 w-3.5" />{pr.label}</span>
            {t.due_date && <span className={cn("inline-flex items-center gap-1", late && "font-semibold text-rose-600")}><CalendarDays className="h-3.5 w-3.5" />Due {formatDate(t.due_date)}</span>}
            {rel && <Link href={rel.href} className="inline-flex items-center gap-1 hover:text-brand-700"><Link2 className="h-3.5 w-3.5" /><span className="capitalize">{rel.kind}</span> · {rel.label}</Link>}
          </span>
        }
        actions={
          <>
            {!assigned && (
              <form action={toggleFollow}>
                <input type="hidden" name="task_id" value={id} />
                <input type="hidden" name="follow" value={following ? "0" : "1"} />
                <Button variant="secondary" size="sm">{following ? <><BellOff className="h-3.5 w-3.5" /> Unfollow</> : <><Bell className="h-3.5 w-3.5" /> Follow</>}</Button>
              </form>
            )}
            {canEdit && <LinkButton href={`${path}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
            {can("tasks", "full") && (
              <ConfirmForm action={deleteTask} message="Delete this task, its checklist, comments and files?">
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete task"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{t.description || <span className="text-slate-400">No description.</span>}</p>
              <dl className="grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
                <div><dt className="label">Start</dt><dd>{formatDate(t.start_date)}</dd></div>
                <div><dt className="label">Due</dt><dd className={cn(late && "font-semibold text-rose-600")}>{formatDate(t.due_date)}</dd></div>
                <div><dt className="label">Created by</dt><dd className="truncate">{t.creator?.full_name ?? "—"}</dd></div>
                <div><dt className="label">{t.milestone ? "Milestone" : "Completed"}</dt><dd className="truncate">{t.milestone ? <span className="inline-flex items-center gap-1"><Milestone className="h-3.5 w-3.5 text-slate-400" />{t.milestone.name}</span> : t.completed_at ? formatDate(t.completed_at) : "—"}</dd></div>
              </dl>
              <div className="border-t border-slate-100 pt-4">
                <div className="label">Tags</div>
                <RecordTags relType="task" relId={id} path={path} canEdit={canEdit} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Checklist" />
            <CardBody>
              <Checklist
                taskId={id}
                canEdit={canEdit}
                items={(items ?? []).map((i) => ({ id: i.id, description: i.description, is_done: i.is_done, done_by_name: i.done_by_profile?.full_name ?? null }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Attachments" description={files?.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : undefined} />
            <CardBody className="space-y-3">
              {(files ?? []).length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {files!.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                      <a href={`/tasks/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700">{f.name}</a>
                      <span className="hidden text-xs text-slate-400 sm:inline">{kb(Number(f.size))} · {f.uploader?.full_name?.split(" ")[0] ?? "—"}</span>
                      <a href={`/tasks/files/${f.id}`} className="rounded p-1 text-slate-400 hover:text-brand-700" aria-label={`Download ${f.name}`}><Download className="h-4 w-4" /></a>
                      {canEdit && (
                        <ConfirmForm action={deleteTaskFile} message={`Delete ${f.name}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={`Delete ${f.name}`}><Trash2 className="h-4 w-4" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? <TaskFileUploader taskId={id} /> : !files?.length && <p className="text-sm text-slate-400">No files.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Comments" description={comments?.length ? `${comments.length} comment${comments.length === 1 ? "" : "s"}` : undefined} />
            <CardBody className="space-y-5">
              {(comments ?? []).length > 0 && (
                <ul className="space-y-4">
                  {comments!.map((c) => (
                    <li key={c.id} className="group flex gap-3">
                      <Avatar name={c.author?.full_name} />
                      <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-4 py-3">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span suppressHydrationWarning><b className="text-slate-700">{c.author?.full_name ?? "Former staff"}</b> · {timeAgo(c.created_at)}</span>
                          {(c.created_by === profile.id || profile.is_admin) && (
                            <ConfirmForm action={deleteTaskComment} message="Delete this comment?">
                              <input type="hidden" name="id" value={c.id} />
                              <button className="text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>
                            </ConfirmForm>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <CommentBox taskId={id} />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Time tracking" description={`${total} h on this task${myTotal ? ` · ${myTotal} h by you` : ""}`} />
            <CardBody className="space-y-4">
              <TimerControl
                taskId={id}
                canTrack={can("tasks", "edit") || can("projects", "edit")}
                running={mine ? { id: mine.id, task_id: mine.task_id, started_at: mine.started_at, task_name: mine.task?.name ?? "another task" } : null}
              />
              {t.rel_type === "project" && <p className="text-xs text-slate-500">Stopped timers are added to the project&apos;s timesheet as billable time.</p>}
              {(timers ?? []).filter((x) => x.ended_at).length > 0 && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
                  {timers!.filter((x) => x.ended_at).slice(0, 6).map((x) => (
                    <li key={x.id} className="group flex items-center gap-2 py-2 text-xs">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-slate-700">{x.note || <span className="text-slate-400">No note</span>}</div>
                        <div className="text-slate-400" suppressHydrationWarning>{x.staff?.full_name?.split(" ")[0]} · {formatDateTime(x.started_at)}</div>
                      </div>
                      <b className="tabular-nums text-slate-800">{hrs(new Date(x.ended_at!).getTime() - new Date(x.started_at).getTime())} h</b>
                      {(x.staff_id === profile.id || profile.is_admin) && (
                        <ConfirmForm action={deleteTimer} message="Delete this time entry? (Project timesheet entries stay — remove them on the project.)">
                          <input type="hidden" name="id" value={x.id} />
                          <button className="rounded p-0.5 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete time entry"><Trash2 className="h-3.5 w-3.5" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="People" />
            <CardBody className="space-y-4">
              <div>
                <div className="label">Assignees</div>
                <ul className="space-y-2">
                  {(assignees ?? []).map((a) => (
                    <li key={a.staff_id} className="flex items-center gap-2.5 text-sm">
                      <Avatar name={a.staff?.full_name} className="h-7 w-7 text-[10px]" />
                      <span className="font-medium text-slate-800">{a.staff?.full_name}</span>
                      {a.staff_id === profile.id && <span className="text-xs text-slate-400">(you)</span>}
                    </li>
                  ))}
                  {!assignees?.length && <li className="flex items-center gap-2 text-sm text-slate-400"><User className="h-4 w-4" /> Unassigned</li>}
                </ul>
              </div>
              <div>
                <div className="label">Followers</div>
                {(followers ?? []).length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {followers!.map((f) => (
                      <span key={f.staff_id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-xs text-slate-700">
                        <Avatar name={f.staff?.full_name} className="h-5 w-5 text-[8px]" /> {f.staff?.full_name?.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Followers get comment and completion alerts.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <RemindersPanel relType="task" relId={id} path={path} />
        </aside>
      </div>
    </>
  );
}
