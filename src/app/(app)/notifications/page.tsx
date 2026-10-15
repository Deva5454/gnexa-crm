import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { clearRead, markAllRead } from "@/lib/actions/notifications";
import { requireStaff } from "@/lib/auth";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };
const SIZE = 30;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, profile } = await requireStaff();
  await supabase.rpc("flush_reminders");
  let q = supabase
    .from("notifications")
    .select("id, title, body, link, is_read, created_at, actor:profiles!notifications_actor_id_fkey(full_name)", { count: "exact" })
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * SIZE, page * SIZE - 1);
  if (sp.filter === "unread") q = q.eq("is_read", false);
  const { data: rows, count } = await q;
  const pill = (active: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Assignments, comments, client actions and your reminders."
        actions={
          <>
            <form action={markAllRead}><Button variant="secondary" size="sm"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</Button></form>
            <form action={clearRead}><Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5" /> Clear read</Button></form>
          </>
        }
      />
      <Card>
        <div className="flex gap-1.5 border-b border-slate-100 p-4">
          <Link href="/notifications" className={pill(sp.filter !== "unread")}>All</Link>
          <Link href="/notifications?filter=unread" className={pill(sp.filter === "unread")}>Unread</Link>
        </div>
        {!rows?.length ? (
          <EmptyState icon={Bell} title="Nothing here" description="You're all caught up." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {rows.map((n) => {
                const Inner = (
                  <>
                    <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", n.title === "Reminder" ? "bg-amber-100 text-amber-600" : "bg-brand-100 text-brand-600")}>
                      {n.title === "Reminder" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.is_read ? "text-slate-600" : "font-semibold text-slate-900")}>{n.title}</span>
                      {n.body && <span className="block text-sm text-slate-500">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-slate-400" suppressHydrationWarning>{formatDateTime(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className={cn("flex gap-3 px-5 py-3.5 hover:bg-slate-50", !n.is_read && "bg-brand-50/40")}>{Inner}</Link>
                    ) : (
                      <div className={cn("flex gap-3 px-5 py-3.5", !n.is_read && "bg-brand-50/40")}>{Inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageSize={SIZE} total={count ?? 0} basePath="/notifications" params={{ filter: sp.filter }} />
          </>
        )}
      </Card>
    </div>
  );
}
