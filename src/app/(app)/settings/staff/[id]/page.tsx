import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { daysFromToday, monthStartIST } from "@/lib/dates";
import { formatDate, formatDateTime } from "@/lib/utils";
import { addStaffNote, deleteStaffNote, saveStaffMember } from "../../actions";

export const metadata: Metadata = { title: "Staff member" };

const hrs = (n: number) => `${Math.round(n * 10) / 10} h`;

/** Perfex staff profile: details and access, workload, recent time and private notes. */
export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const { supabase, profile: me } = await requireAdmin();
  const { data: s } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const self = s.id === me.id;
  const since30 = daysFromToday(-30);

  const [{ data: roles }, { data: depts }, { data: mine }, { data: assigned }, { data: time }, { data: projects }, leads, tickets, requests, { data: notes }] = await Promise.all([
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("staff_departments").select("department_id").eq("staff_id", id),
    supabase.from("task_assignees").select("task:tasks(id, name, status, due_date, completed_at)").eq("staff_id", id),
    supabase.from("timesheets").select("id, date, hours, note, project:projects(id, name), task:tasks(id, name)").eq("staff_id", id).gte("date", daysFromToday(-90)).order("date", { ascending: false }).order("id", { ascending: false }),
    supabase.from("project_members").select("project:projects(id, name, status)").eq("staff_id", id),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", id).is("converted_customer_id", null).eq("is_lost", false).eq("is_junk", false),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("assigned_to", id).neq("status", "closed"),
    supabase.from("estimate_requests").select("id", { count: "exact", head: true }).eq("assigned_to", id),
    supabase.from("staff_notes").select("id, body, created_at, author:profiles!staff_notes_created_by_fkey(full_name)").eq("staff_id", id).order("created_at", { ascending: false }),
  ]);
  const tasks = (assigned ?? []).map((a) => a.task).filter((t): t is NonNullable<typeof t> => !!t);
  const open = tasks.filter((t) => t.status !== "complete");
  const overdue = open.filter((t) => t.due_date && t.due_date < daysFromToday(0));
  const done30 = tasks.filter((t) => t.status === "complete" && t.completed_at && t.completed_at.slice(0, 10) >= since30);
  const sum = (list: { hours: number }[]) => list.reduce((n, t) => n + Number(t.hours), 0);
  const thisMonth = sum((time ?? []).filter((t) => t.date >= monthStartIST()));
  const last30 = sum((time ?? []).filter((t) => t.date >= since30));
  const activeProjects = (projects ?? []).map((p) => p.project).filter((p): p is NonNullable<typeof p> => !!p && p.status !== "finished" && p.status !== "cancelled");
  const memberOf = new Set((mine ?? []).map((m) => m.department_id));

  const stats: [string, string | number, string?][] = [
    ["Open tasks", open.length, overdue.length ? `${overdue.length} overdue` : undefined],
    ["Tasks done (30 days)", done30.length],
    ["Hours this month", hrs(thisMonth), `${hrs(last30)} in the last 30 days`],
    ["Active projects", activeProjects.length],
    ["Open leads", leads.count ?? 0],
    ["Open tickets", tickets.count ?? 0],
    ["Estimate requests", requests.count ?? 0],
  ];
  const check = "h-4 w-4 rounded border-slate-300 text-brand-600";

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={s.full_name} className="h-14 w-14 text-lg" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-500"><Link href="/settings/staff" className="hover:text-brand-600">Staff</Link></div>
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900">
              {s.full_name}
              {self && <Badge>You</Badge>}
              {s.is_admin && <Badge className="bg-brand-50 text-brand-700 ring-brand-200">Administrator</Badge>}
              {!s.is_active && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Pending</Badge>}
            </h2>
            <p className="truncate text-sm text-slate-500">{[s.job_title, s.email, s.phone].filter(Boolean).join(" · ")} · joined {formatDate(s.created_at)}</p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {stats.map(([label, value, sub]) => (
          <Card key={label} className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
            {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Profile & access" />
          <CardBody>
            <form action={saveStaffMember} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={s.id} />
              <Field label="Full name *" htmlFor="full_name"><input id="full_name" name="full_name" defaultValue={s.full_name} required maxLength={120} className="field" /></Field>
              <Field label="Job title" htmlFor="job_title"><input id="job_title" name="job_title" defaultValue={s.job_title ?? ""} maxLength={120} className="field" /></Field>
              <Field label="Phone" htmlFor="phone"><input id="phone" name="phone" defaultValue={s.phone ?? ""} maxLength={40} className="field" /></Field>
              <Field label="Role" htmlFor="role_id" hint={s.is_admin ? "Administrators can do everything, whatever the role" : undefined}>
                <select id="role_id" name="role_id" defaultValue={s.role_id ?? ""} className="field">
                  <option value="">No role</option>
                  {(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              {(depts?.length ?? 0) > 0 && (
                <fieldset className="sm:col-span-2">
                  <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Support departments</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {depts!.map((d) => (
                      <label key={d.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:checked]:ring-brand-200">
                        <input type="checkbox" name="dept" value={d.id} defaultChecked={memberOf.has(d.id)} className="h-3 w-3 rounded border-slate-300 text-brand-600" />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 sm:col-span-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={s.is_active} disabled={self} className={check} /> Active (can sign in)</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="is_admin" defaultChecked={s.is_admin} disabled={self} className={check} /> Administrator</label>
                <SubmitButton pendingText="Saving…" className="ml-auto">Save</SubmitButton>
              </div>
              {self && <p className="text-xs text-slate-400 sm:col-span-2">You can&apos;t remove your own access.</p>}
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notes" description="Private to administrators — the staff member doesn't see them" />
          <CardBody className="space-y-3">
            <form action={addStaffNote} className="space-y-2">
              <input type="hidden" name="staff_id" value={s.id} />
              <textarea name="body" rows={3} required maxLength={5000} placeholder="Add a note…" aria-label="New note" className="field" />
              <div className="flex justify-end"><SubmitButton size="sm" pendingText="Saving…">Add note</SubmitButton></div>
            </form>
            {(notes ?? []).map((n) => (
              <div key={n.id} className="group rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>
                  <ConfirmForm action={deleteStaffNote} message="Delete this note?">
                    <input type="hidden" name="id" value={n.id} />
                    <button className="text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Delete note"><Trash2 className="h-3.5 w-3.5" /></button>
                  </ConfirmForm>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">{n.author?.full_name ?? "—"} · {formatDateTime(n.created_at)}</div>
              </div>
            ))}
            {!notes?.length && <p className="text-sm text-slate-400">No notes yet.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Open tasks" description={`${open.length} assigned`} />
          <ul className="divide-y divide-slate-100 text-sm">
            {open.slice(0, 10).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <Link href={`/tasks/${t.id}`} className="truncate text-slate-800 hover:text-brand-700">{t.name}</Link>
                <span className={t.due_date && t.due_date < daysFromToday(0) ? "shrink-0 text-xs font-medium text-rose-600" : "shrink-0 text-xs text-slate-400"}>{t.due_date ? formatDate(t.due_date) : "No due date"}</span>
              </li>
            ))}
            {!open.length && <li className="px-5 py-4 text-slate-400">Nothing open.</li>}
            {open.length > 10 && <li className="px-5 py-2.5 text-xs text-slate-400">and {open.length - 10} more</li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent time" description="Timesheet entries, last 90 days" />
          <ul className="divide-y divide-slate-100 text-sm">
            {(time ?? []).slice(0, 10).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-slate-800">{t.task?.name ?? t.note ?? "Time logged"}</span>
                  {t.project && <Link href={`/projects/${t.project.id}`} className="block truncate text-xs text-slate-500 hover:text-brand-700">{t.project.name}</Link>}
                </span>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  <b className="text-slate-800">{hrs(Number(t.hours))}</b>
                  <span className="block">{formatDate(t.date)}</span>
                </span>
              </li>
            ))}
            {!time?.length && <li className="px-5 py-4 text-slate-400">No time logged.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
