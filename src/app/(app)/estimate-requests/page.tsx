import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ColorBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { cn, timeAgo } from "@/lib/utils";
import { reqStatuses } from "./status";

export const metadata: Metadata = { title: "Estimate requests" };

export default async function EstimateRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireFeature("estimate_requests"); // Setup → Modules
  const sp = await searchParams;
  const { supabase, can, profile } = await requireStaff();
  const statuses = await reqStatuses(supabase);
  const isOpen = (key: string) => statuses.of(key).is_open;
  if (!can("sales", "view")) notFound();
  const { data: all } = await supabase
    .from("estimate_requests")
    .select("id, name, company, email, message, budget, status, created_at, assignee:profiles!estimate_requests_assigned_to_fkey(full_name), form:web_forms(name)")
    .order("created_at", { ascending: false });
  const rows = (all ?? []).filter((r) => (sp.status ? r.status === sp.status : isOpen(r.status)));
  const pill = (on: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", on ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const count = (s: string) => (all ?? []).filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        title="Estimate requests"
        description="Quote requests from your website's “Request a quote” form."
        actions={profile.is_admin && <LinkButton href="/settings/web-forms" variant="secondary">Manage forms</LinkButton>}
      />
      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-4">
          <Link href="/estimate-requests" className={pill(!sp.status)}>Open ({(all ?? []).filter((r) => isOpen(r.status)).length})</Link>
          {statuses.list.map((v) => <Link key={v.key} href={`/estimate-requests?status=${v.key}`} className={pill(sp.status === v.key)}>{v.name} ({count(v.key)})</Link>)}
        </div>
        {!rows.length ? (
          <EmptyState icon={Inbox} title="Inbox zero" description="New requests from your website appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const st = statuses.of(r.status);
              return (
                <li key={r.id}>
                  <Link href={`/estimate-requests/${r.id}`} className="flex items-start gap-4 px-5 py-4 hover:bg-brand-50/30">
                    <Avatar name={r.company ?? r.name} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{r.name}</span>
                        {r.company && <span className="text-sm text-slate-500">· {r.company}</span>}
                        {r.budget && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{r.budget}</span>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{r.message}</p>
                      <div className="mt-1 text-xs text-slate-400" suppressHydrationWarning>{timeAgo(r.created_at)} · {r.form?.name ?? "Web form"}{r.assignee ? ` · ${r.assignee.full_name}` : " · unassigned"}</div>
                    </div>
                    <ColorBadge color={st.color}>{st.name}</ColorBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
