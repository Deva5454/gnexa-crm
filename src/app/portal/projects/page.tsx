import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePortal } from "@/lib/auth";
import { projectStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

export default async function PortalProjects() {
  const { supabase } = await requirePortal();
  const [{ data: projects }, { data: tasks }] = await Promise.all([
    supabase.from("projects").select("id, name, status, start_date, deadline, description").order("start_date", { ascending: false }),
    supabase.from("tasks").select("rel_id, status"),
  ]);
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
      {!projects?.length ? <Card><EmptyState icon={FolderKanban} title="No projects yet" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const ts = (tasks ?? []).filter((t) => t.rel_id === p.id);
            const pct = ts.length ? Math.round((ts.filter((t) => t.status === "complete").length / ts.length) * 100) : 0;
            const s = projectStatus(p.status);
            return (
              <Link key={p.id} href={`/portal/projects/${p.id}`} className="group">
                <Card className="h-full p-5 transition group-hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</h2><Badge className={s.color}>{s.label}</Badge></div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.description}</p>
                  <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${pct}%` }} /></div><b className="text-sm">{pct}%</b></div>
                  <div className="mt-2 text-xs text-slate-500">Target date {formatDate(p.deadline)}</div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
