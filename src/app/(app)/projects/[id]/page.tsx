import type { Metadata } from "next";
import { Gantt } from "@/components/crm/gantt";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { RecordTags } from "@/components/crm/tags";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock, Download, FileText, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { Tabs } from "@/components/ui/tabs";
import { requireStaff } from "@/lib/auth";
import { projectStatus, taskPriority, taskStatus } from "@/lib/constants";
import { docHref, docNumber, docStatus } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { cn, formatDate, formatMoney, timeAgo } from "@/lib/utils";
import { deleteComment, deleteFile, deleteMilestone, deleteProject, deleteTimesheet, invoiceProject, toggleMilestone } from "../actions";
import { CommentForm, FileUploader, MilestoneForm, StatusPicker, TimeForm } from "./panels";

export const metadata: Metadata = { title: "Project" };

function bytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const id = Number((await params).id);
  const tab = (await searchParams).tab ?? "overview";
  const { supabase, can, profile } = await requireStaff();
  if (!can("projects", "view")) notFound();

  const [{ data: p }, { data: members }, { data: milestones }, { data: tasks }, { data: times }, { data: files }, { data: comments }, { data: invoices }] = await Promise.all([
    supabase.from("projects").select("*, customer:customers(id, company)").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("staff_id, staff:profiles(full_name, job_title)").eq("project_id", id),
    supabase.from("milestones").select("*").eq("project_id", id).order("position"),
    supabase
      .from("tasks")
      .select("id, name, status, priority, start_date, due_date, milestone_id, task_assignees(staff_id, staff:profiles(full_name))")
      .eq("rel_type", "project")
      .eq("rel_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("timesheets").select("id, date, hours, note, is_billable, invoice_id, staff_id, task:tasks(name), staff:profiles(full_name)").eq("project_id", id).order("date", { ascending: false }),
    supabase.from("project_files").select("id, name, size, mime, created_at, uploader:profiles(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_comments").select("id, body, created_at, created_by, author:profiles(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("sales_docs").select("id, number, status, due_date, total, date").eq("kind", "invoice").eq("project_id", id).order("date", { ascending: false }),
  ]);
  if (!p) notFound();

  const s = projectStatus(p.status);
  const allTasks = tasks ?? [];
  const done = allTasks.filter((t) => t.status === "complete").length;
  const pct = allTasks.length ? Math.round((done / allTasks.length) * 100) : 0;
  const entries = times ?? [];
  const totalHrs = entries.reduce((a, t) => a + Number(t.hours), 0);
  const billableHrs = entries.filter((t) => t.is_billable).reduce((a, t) => a + Number(t.hours), 0);
  const unbilledHrs = entries.filter((t) => t.is_billable && !t.invoice_id).reduce((a, t) => a + Number(t.hours), 0);
  const invBals = await balancesFor(supabase, (invoices ?? []).map((i) => i.id));
  const invoiced = (invoices ?? []).filter((i) => i.status !== "cancelled").reduce((a, i) => a + Number(i.total), 0);
  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = p.deadline ? Math.round((new Date(p.deadline).getTime() - new Date(today).getTime()) / 86400_000) : null;
  const canEdit = can("projects", "edit");
  const canDelete = can("projects", "full");
  const canInvoice = canEdit && can("sales", "edit") && (p.billing_type === "hourly" ? unbilledHrs > 0 : !(invoices ?? []).some((i) => i.status !== "cancelled"));
  const base = `/projects/${id}`;

  const tabs = [
    { key: "overview", label: "Overview", href: base },
    { key: "tasks", label: "Tasks", href: `${base}?tab=tasks`, count: allTasks.length },
    { key: "milestones", label: "Milestones", href: `${base}?tab=milestones`, count: milestones?.length ?? 0 },
    { key: "gantt", label: "Gantt", href: `${base}?tab=gantt` },
    { key: "timesheets", label: "Timesheets", href: `${base}?tab=timesheets`, count: entries.length },
    { key: "files", label: "Files", href: `${base}?tab=files`, count: files?.length ?? 0 },
    { key: "discussion", label: "Discussion", href: `${base}?tab=discussion`, count: comments?.length ?? 0 },
  ];

  const TaskRow = ({ t }: { t: (typeof allTasks)[number] }) => {
    const st = taskStatus(t.status);
    const late = t.status !== "complete" && t.due_date && t.due_date < today;
    return (
      <li className="flex items-center gap-3 px-5 py-3">
        {t.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-accent-500" /> : <Circle className="h-4 w-4 text-slate-300" />}
        <Link href={`/tasks/${t.id}`} className={cn("min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-700", t.status === "complete" && "text-slate-400 line-through")}>{t.name}</Link>
        <div className="hidden -space-x-1.5 sm:flex">
          {t.task_assignees.map((a) => <Avatar key={a.staff_id} name={a.staff?.full_name} className="h-6 w-6 text-[9px] ring-2 ring-white" />)}
        </div>
        <span className={cn("hidden text-xs font-medium md:inline", taskPriority(t.priority).color)}>{taskPriority(t.priority).label}</span>
        <span className={cn("w-24 text-right text-xs", late ? "font-semibold text-rose-600" : "text-slate-500")}>{formatDate(t.due_date)}</span>
        <Badge className={st.color}>{st.label}</Badge>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/projects" className="hover:text-brand-600">Projects</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{p.name}<Badge className={s.color}>{s.label}</Badge></span>}
        description={p.customer ? <Link href={`/customers/${p.customer.id}`} className="hover:text-brand-600">{p.customer.company}</Link> : null}
        actions={
          <>
            {canEdit && <StatusPicker id={id} status={p.status} />}
            {canInvoice && (
              <form action={invoiceProject}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="accent" size="sm" pendingText="Creating…">
                  <ReceiptText className="h-3.5 w-3.5" /> {p.billing_type === "hourly" ? `Invoice ${unbilledHrs} h` : "Invoice project"}
                </SubmitButton>
              </form>
            )}
            {canEdit && <LinkButton href={`${base}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
            {canDelete && (
              <ConfirmForm action={deleteProject} message={`Delete project “${p.name}”? Its tasks, milestones, time entries, files and discussion are deleted too.`}>
                <input type="hidden" name="id" value={id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete project"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />

      <div className="-mt-3 mb-5"><RecordTags relType="project" relId={id} path={base} canEdit={canEdit} /></div>
      <Tabs tabs={tabs} active={tab} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-4">
              <Card className="px-5 py-4 sm:col-span-2">
                <div className="mb-2 flex justify-between text-xs"><span className="font-medium text-slate-500">Progress</span><span className="font-bold text-slate-900">{pct}%</span></div>
                <div className="h-2.5 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${pct}%` }} /></div>
                <div className="mt-2 text-xs text-slate-500">{done} of {allTasks.length} tasks done · {(milestones ?? []).filter((m) => m.is_complete).length}/{milestones?.length ?? 0} milestones</div>
              </Card>
              <Card className="px-5 py-4">
                <div className="text-xs font-medium text-slate-500">Hours logged</div>
                <div className="mt-1 text-xl font-bold">{totalHrs} h</div>
                <div className="text-xs text-slate-400">{billableHrs} h billable</div>
              </Card>
              <Card className="px-5 py-4">
                <div className="text-xs font-medium text-slate-500">{daysLeft == null ? "Deadline" : daysLeft >= 0 ? "Days left" : "Days overdue"}</div>
                <div className={cn("mt-1 text-xl font-bold", daysLeft != null && daysLeft < 0 && p.status !== "finished" ? "text-rose-600" : "text-slate-900")}>
                  {daysLeft == null ? "—" : Math.abs(daysLeft)}
                </div>
                <div className="text-xs text-slate-400">{formatDate(p.deadline)}</div>
              </Card>
            </div>
            <Card>
              <CardHeader title="About this project" />
              <CardBody className="space-y-5">
                <p className="whitespace-pre-wrap text-sm text-slate-600">{p.description || "No description."}</p>
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <div><dt className="label">Billing</dt><dd>{p.billing_type === "hourly" ? `Hourly · ${formatMoney(Number(p.hourly_rate))}/h` : `Fixed · ${formatMoney(Number(p.fixed_price))}`}</dd></div>
                  <div><dt className="label">Invoiced</dt><dd>{formatMoney(invoiced)}</dd></div>
                  <div><dt className="label">{p.billing_type === "hourly" ? "Unbilled time" : "Started"}</dt><dd>{p.billing_type === "hourly" ? `${unbilledHrs} h · ${formatMoney(unbilledHrs * Number(p.hourly_rate))}` : formatDate(p.start_date)}</dd></div>
                </dl>
              </CardBody>
            </Card>
            {(invoices?.length ?? 0) > 0 && (
              <Card>
                <CardHeader title="Invoices" />
                <ul className="divide-y divide-slate-100">
                  {invoices!.map((i) => {
                    const st = docStatus({ kind: "invoice", status: i.status, due_date: i.due_date, total: Number(i.total) }, invBals.get(i.id));
                    return (
                      <li key={i.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <Link href={docHref("invoice", i.id)} className="font-mono font-semibold text-brand-700">{docNumber("invoice", i.number)}</Link>
                        <span className="text-slate-500">{formatDate(i.date)}</span>
                        <b>{formatMoney(Number(i.total))}</b>
                        <Badge className={st.color}>{st.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Team" />
              <ul className="space-y-3 p-5">
                {(members ?? []).map((m) => (
                  <li key={m.staff_id} className="flex items-center gap-3 text-sm">
                    <Avatar name={m.staff?.full_name} />
                    <div><div className="font-medium text-slate-800">{m.staff?.full_name}</div><div className="text-xs text-slate-400">{m.staff?.job_title}</div></div>
                  </li>
                ))}
                {!members?.length && <li className="text-sm text-slate-400">No one assigned yet.</li>}
              </ul>
            </Card>
            <CustomFieldsCard entity="project" relId={id} path={base} />
            <RemindersPanel relType="project" relId={id} path={base} />
            <Card>
              <CardHeader title="Activity" />
              <ActivityFeed relType="project" relId={id} limit={8} />
            </Card>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-6">
          {[...(milestones ?? []).map((m) => ({ key: m.id, title: m.name, sub: m.due_date ? `Due ${formatDate(m.due_date)}` : undefined, done: m.is_complete })), { key: 0, title: "Other tasks", sub: undefined, done: false }].map((g) => {
            const list = allTasks.filter((t) => (t.milestone_id ?? 0) === g.key);
            if (!list.length && g.key === 0) return null;
            return (
              <Card key={g.key}>
                <CardHeader
                  title={<span className="flex items-center gap-2">{g.done && <CheckCircle2 className="h-4 w-4 text-accent-500" />}{g.title}</span>}
                  description={g.sub}
                  action={can("tasks", "edit") && <LinkButton href={`/tasks/new?rel_type=project&rel_id=${id}${g.key ? `&milestone=${g.key}` : ""}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Task</LinkButton>}
                />
                {list.length ? <ul className="divide-y divide-slate-100">{list.map((t) => <TaskRow key={t.id} t={t} />)}</ul> : <p className="px-5 py-4 text-sm text-slate-400">No tasks yet.</p>}
              </Card>
            );
          })}
          {!milestones?.length && !allTasks.length && (
            <Card><CardBody className="text-sm text-slate-500">No tasks yet. {can("tasks", "edit") && <Link href={`/tasks/new?rel_type=project&rel_id=${id}`} className="font-semibold text-brand-600">Add the first task →</Link>}</CardBody></Card>
          )}
        </div>
      )}

      {tab === "milestones" && (
        <Card>
          <CardHeader title="Milestones" description="Group tasks into deliverable phases." />
          <ol className="divide-y divide-slate-100">
            {(milestones ?? []).map((m, i) => {
              const ts = allTasks.filter((t) => t.milestone_id === m.id);
              const d = ts.filter((t) => t.status === "complete").length;
              const late = !m.is_complete && m.due_date && m.due_date < today;
              return (
                <li key={m.id} className="group flex items-center gap-4 px-5 py-4">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", m.is_complete ? "bg-accent-500 text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("font-medium", m.is_complete ? "text-slate-500" : "text-slate-900")}>{m.name}</div>
                    <div className="text-xs text-slate-500">{d}/{ts.length} tasks · <span className={late ? "font-semibold text-rose-600" : ""}>due {formatDate(m.due_date)}</span></div>
                  </div>
                  {canEdit && (
                    <form action={toggleMilestone}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="done" value={m.is_complete ? "0" : "1"} />
                      <Button size="sm" variant={m.is_complete ? "ghost" : "secondary"}>{m.is_complete ? "Reopen" : "Mark complete"}</Button>
                    </form>
                  )}
                  {canDelete && (
                    <ConfirmForm action={deleteMilestone} message={`Delete milestone “${m.name}”? Its tasks stay on the project.`}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="rounded p-1 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete milestone"><Trash2 className="h-4 w-4" /></button>
                    </ConfirmForm>
                  )}
                </li>
              );
            })}
            {!milestones?.length && <li className="px-5 py-6 text-sm text-slate-400">No milestones yet.</li>}
          </ol>
          {canEdit && <MilestoneForm projectId={id} />}
        </Card>
      )}

      {tab === "timesheets" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Total logged", `${totalHrs} h`],
              ["Billable", `${billableHrs} h`],
              ["Not yet invoiced", p.billing_type === "hourly" ? `${unbilledHrs} h · ${formatMoney(unbilledHrs * Number(p.hourly_rate))}` : `${unbilledHrs} h`],
            ].map(([l, v]) => (
              <Card key={l} className="px-5 py-4"><div className="text-xs font-medium text-slate-500">{l}</div><div className="mt-1 text-xl font-bold">{v}</div></Card>
            ))}
          </div>
          <Card>
            <CardHeader title="Time entries" description={p.billing_type === "hourly" ? "Unbilled billable hours go on the next invoice — use the Invoice button at the top." : "Fixed-price project — time is tracked for effort, not billed."} />
            {(canEdit || can("tasks", "edit")) && <TimeForm projectId={id} tasks={allTasks.map((t) => ({ id: t.id, name: t.name }))} billableDefault={p.billing_type === "hourly"} />}
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="table-base">
                <thead><tr><th>Date</th><th>Who</th><th>Task</th><th className="hidden md:table-cell">Note</th><th className="text-right">Hours</th><th>Billing</th><th className="w-8" /></tr></thead>
                <tbody>
                  {entries.map((t) => (
                    <tr key={t.id} className="group">
                      <td className="whitespace-nowrap text-slate-600">{formatDate(t.date)}</td>
                      <td><span className="flex items-center gap-2"><Avatar name={t.staff?.full_name} className="h-6 w-6 text-[9px]" />{t.staff?.full_name}</span></td>
                      <td className="text-slate-700">{t.task?.name ?? <span className="text-slate-400">General</span>}</td>
                      <td className="hidden max-w-[240px] truncate text-slate-500 md:table-cell">{t.note ?? "—"}</td>
                      <td className="text-right font-semibold">{Number(t.hours)}</td>
                      <td>
                        {t.invoice_id ? <Link href={docHref("invoice", t.invoice_id)}><Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Invoiced</Badge></Link>
                          : t.is_billable ? <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Unbilled</Badge>
                          : <span className="text-xs text-slate-400">Non-billable</span>}
                      </td>
                      <td>
                        {!t.invoice_id && (t.staff_id === profile.id || canDelete) && (
                          <ConfirmForm action={deleteTimesheet} message="Delete this time entry?">
                            <input type="hidden" name="id" value={t.id} />
                            <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete entry"><Trash2 className="h-3.5 w-3.5" /></button>
                          </ConfirmForm>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!entries.length && <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400"><Clock className="mx-auto mb-2 h-5 w-5" />No time logged yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "gantt" && (
        <Card>
          <CardHeader title="Timeline" description="Tasks from start to due date, grouped by milestone. Click a bar to open the task." />
          {allTasks.length || (milestones?.length ?? 0) ? (
            <Gantt start={p.start_date} end={p.deadline} tasks={allTasks} milestones={milestones ?? []} />
          ) : (
            <p className="px-5 py-6 text-sm text-slate-400">Add tasks with start and due dates to see the timeline.</p>
          )}
        </Card>
      )}

      {tab === "files" && (
        <Card>
          <CardHeader title="Files" description="Private to your team. Links expire after a minute." />
          {canEdit && <FileUploader projectId={id} />}
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {(files ?? []).map((f) => (
              <li key={f.id} className="group flex items-center gap-3 px-5 py-3 text-sm">
                <FileText className="h-5 w-5 shrink-0 text-brand-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-800">{f.name}</div>
                  <div className="text-xs text-slate-400">{bytes(Number(f.size))} · {f.uploader?.full_name ?? "—"} · {timeAgo(f.created_at)}</div>
                </div>
                <a href={`/projects/files/${f.id}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700" aria-label={`Download ${f.name}`}><Download className="h-4 w-4" /></a>
                {canDelete && (
                  <ConfirmForm action={deleteFile} message={`Delete “${f.name}”?`}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="rounded p-1.5 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete file"><Trash2 className="h-4 w-4" /></button>
                  </ConfirmForm>
                )}
              </li>
            ))}
            {!files?.length && <li className="px-5 py-6 text-sm text-slate-400">No files yet.</li>}
          </ul>
        </Card>
      )}

      {tab === "discussion" && (
        <Card>
          <CardHeader title="Discussion" description="Updates and decisions for the whole team." />
          <CardBody className="space-y-5">
            <CommentForm projectId={id} />
            <ul className="space-y-4">
              {(comments ?? []).map((c) => (
                <li key={c.id} className="group flex gap-3">
                  <Avatar name={c.author?.full_name} />
                  <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-4 py-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span suppressHydrationWarning><b className="text-slate-700">{c.author?.full_name ?? "Former staff"}</b> · {timeAgo(c.created_at)}</span>
                      {(c.created_by === profile.id || profile.is_admin) && (
                        <ConfirmForm action={deleteComment} message="Delete this comment?">
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>
                        </ConfirmForm>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
