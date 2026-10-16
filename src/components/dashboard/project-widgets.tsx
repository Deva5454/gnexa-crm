import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { PROJECT_STATUSES } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

// Solid fills for the project status chart, in PROJECT_STATUSES order
const FILL: Record<string, string> = {
  not_started: "#94a3b8",
  in_progress: "#0ea5e9",
  on_hold: "#f59e0b",
  finished: "#10b981",
  cancelled: "#334155",
};

/** Perfex "Statistics by project status". */
export async function ProjectsChart({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  if (!can("projects", "view")) return null;
  const { data } = await supabase.from("projects").select("status");
  const total = data?.length ?? 0;
  const rows = PROJECT_STATUSES.map((s) => ({ ...s, count: (data ?? []).filter((p) => p.status === s.value).length }));
  return (
    <Card className={className}>
      <CardHeader title="Projects by status" description={`${total} project${total === 1 ? "" : "s"}`} action={<Link href="/projects" className="text-xs font-semibold text-brand-600 hover:text-brand-700">Projects →</Link>} />
      <CardBody className="space-y-4">
        {total > 0 && (
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={rows.map((r) => `${r.label} ${r.count}`).join(", ")}>
            {rows.filter((r) => r.count).map((r) => (
              <div key={r.value} title={`${r.label}: ${r.count}`} style={{ width: `${(r.count / total) * 100}%`, background: FILL[r.value] }} />
            ))}
          </div>
        )}
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.value}>
              <Link href={`/projects?status=${r.value}`} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: FILL[r.value] }} />
                <span className="flex-1 text-slate-700">{r.label}</span>
                <span className="font-semibold text-slate-900">{r.count}</span>
                <span className="w-10 text-right text-xs text-slate-400">{total ? Math.round((r.count / total) * 100) : 0}%</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/** Perfex "Latest project activity": what's happened on projects lately, with the project named. */
export async function ProjectActivity({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  if (!can("projects", "view")) return null;
  const { data } = await supabase
    .from("activity_log")
    .select("id, description, created_at, rel_id, actor:profiles!activity_log_actor_id_fkey(full_name)")
    .eq("rel_type", "project")
    .order("created_at", { ascending: false })
    .limit(8);
  const ids = [...new Set((data ?? []).map((a) => a.rel_id).filter((x): x is number => x != null))];
  const { data: projects } = ids.length ? await supabase.from("projects").select("id, name").in("id", ids) : { data: [] };
  const names = new Map((projects ?? []).map((p) => [p.id, p.name]));
  return (
    <Card className={className}>
      <CardHeader title="Latest project activity" />
      {!data?.length ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">No project activity yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((a) => (
            <li key={a.id} className="px-5 py-2.5 text-sm">
              <p className="text-slate-700">
                {a.actor && <b className="font-semibold text-slate-900">{a.actor.full_name} </b>}
                {a.description}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                {a.rel_id != null && names.has(a.rel_id) && (
                  <Link href={`/projects/${a.rel_id}`} className="flex min-w-0 items-center gap-1 truncate font-medium text-brand-600 hover:text-brand-700">
                    <FolderKanban className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{names.get(a.rel_id)}</span>
                  </Link>
                )}
                <span className="shrink-0" suppressHydrationWarning>{timeAgo(a.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
