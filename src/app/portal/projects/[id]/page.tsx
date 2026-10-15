import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { projectStatus } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Project" };

export default async function PortalProject({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requirePortal();
  const [{ data: p }, { data: milestones }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("id, name, status, start_date, deadline, description").eq("id", id).maybeSingle(),
    supabase.from("milestones").select("id, name, due_date, is_complete").eq("project_id", id).order("position"),
    supabase.from("tasks").select("id, name, status, due_date, milestone_id").eq("rel_type", "project").eq("rel_id", id).order("due_date"),
  ]);
  if (!p) notFound();
  const all = tasks ?? [];
  const pct = all.length ? Math.round((all.filter((t) => t.status === "complete").length / all.length) * 100) : 0;
  const s = projectStatus(p.status);
  const groups = [...(milestones ?? []).map((m) => ({ key: m.id, name: m.name, due: m.due_date, done: m.is_complete })), { key: 0, name: "Other work", due: null as string | null, done: false }];
  return (
    <>
      <Link href="/portal/projects" className="mb-5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> All projects</Link>
      <div className="mb-6 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-slate-900">{p.name}</h1><Badge className={s.color}>{s.label}</Badge></div>
      <Card className="mb-6 p-5">
        <div className="mb-2 flex justify-between text-sm"><span className="text-slate-500">{formatDate(p.start_date)} → {formatDate(p.deadline)}</span><b>{pct}% complete</b></div>
        <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${pct}%` }} /></div>
        {p.description && <p className="mt-4 text-sm text-slate-600">{p.description}</p>}
      </Card>
      <div className="space-y-4">
        {groups.map((g) => {
          const list = all.filter((t) => (t.milestone_id ?? 0) === g.key);
          if (!list.length && g.key === 0) return null;
          return (
            <Card key={g.key}>
              <CardHeader title={<span className="flex items-center gap-2">{g.done && <CheckCircle2 className="h-4 w-4 text-accent-500" />}{g.name}</span>} description={g.due ? `Due ${formatDate(g.due)}` : undefined} />
              <ul className="divide-y divide-slate-100">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    {t.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-accent-500" /> : <Circle className="h-4 w-4 text-slate-300" />}
                    <span className={cn("flex-1", t.status === "complete" && "text-slate-400 line-through")}>{t.name}</span>
                    <span className="text-xs text-slate-500">{formatDate(t.due_date)}</span>
                  </li>
                ))}
                {!list.length && <li className="px-5 py-3 text-sm text-slate-400">No tasks yet.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
