import { Activity } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";

export async function ActivityFeed({ relType, relId, limit = 15 }: { relType?: "customer" | "lead"; relId?: number; limit?: number }) {
  const { supabase } = await requireStaff();
  let q = supabase
    .from("activity_log")
    .select("id, description, created_at, actor:profiles!activity_log_actor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (relType && relId) q = q.eq("rel_type", relType).eq("rel_id", relId);
  const { data } = await q;

  if (!data?.length) {
    return (
      <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400">
        <Activity className="h-4 w-4" /> No activity yet.
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 px-5 py-4 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-slate-200">
      {data.map((a) => (
        <li key={a.id} className="relative flex gap-3 pl-0">
          <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
          <div className="min-w-0 text-sm">
            <p className="text-slate-700">
              <b className="font-semibold text-slate-900">{a.actor?.full_name ?? "System"}</b> {a.description}
            </p>
            <p className="text-xs text-slate-400" suppressHydrationWarning>{timeAgo(a.created_at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
