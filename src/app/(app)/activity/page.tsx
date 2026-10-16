import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireAdmin } from "@/lib/auth";
import { cn, PAGE_SIZE, searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Activity log" };

const TYPES: Record<string, { label: string; path: string }> = {
  customer: { label: "Customers", path: "/customers" },
  lead: { label: "Leads", path: "/leads" },
  task: { label: "Tasks", path: "/tasks" },
  project: { label: "Projects", path: "/projects" },
  ticket: { label: "Support", path: "/support" },
  contract: { label: "Contracts", path: "/contracts" },
};

type SP = { q?: string; type?: string; staff?: string; page?: string };

export default async function ActivityLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase } = await requireAdmin();
  let q = supabase
    .from("activity_log")
    .select("id, description, rel_type, rel_id, created_at, actor:profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.ilike("description", `%${term}%`);
  if (sp.type && sp.type in TYPES) q = q.eq("rel_type", sp.type);
  if (sp.staff) q = q.eq("actor_id", sp.staff);
  const [{ data: rows, count }, { data: staff }] = await Promise.all([q, supabase.from("profiles").select("id, full_name").order("full_name")]);

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch, page: undefined })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/activity?${qs}` : "/activity";
  };
  const pill = (active: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader title="Activity log" description="Everything your team has done in the CRM, newest first." />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={href({ type: undefined })} className={pill(!sp.type)}>All</Link>
            {Object.entries(TYPES).map(([k, v]) => <Link key={k} href={href({ type: sp.type === k ? undefined : k })} className={pill(sp.type === k)}>{v.label}</Link>)}
            <form className="ml-2">
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.type && <input type="hidden" name="type" value={sp.type} />}
              <select name="staff" defaultValue={sp.staff ?? ""} className="field h-8 py-0 text-xs" aria-label="Staff member">
                <option value="">Everyone</option>
                {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <button className="ml-1 text-xs font-medium text-brand-700">Filter</button>
            </form>
          </div>
          <SearchInput placeholder="Search activity…" />
        </div>
        {!rows?.length ? (
          <EmptyState icon={Activity} title="No activity" description="Nothing matches these filters." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const t = r.rel_type ? TYPES[r.rel_type] : undefined;
                return (
                  <li key={r.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                    <Avatar name={r.actor?.full_name ?? "System"} className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700"><b className="text-slate-900">{r.actor?.full_name ?? "System"}</b> {r.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                        {t && r.rel_id && <> · <Link href={`${t.path}/${r.rel_id}`} className="text-brand-700 hover:underline">{t.label.replace(/s$/, "")} #{r.rel_id}</Link></>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/activity" params={{ q: sp.q, type: sp.type, staff: sp.staff }} />
          </>
        )}
      </Card>
    </>
  );
}
