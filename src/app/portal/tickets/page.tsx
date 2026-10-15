import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePortal } from "@/lib/auth";
import { ticketNumber, ticketStatus } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Support" };

export default async function PortalTickets() {
  const { supabase } = await requirePortal();
  const { data } = await supabase.from("tickets").select("id, subject, status, last_reply_at").order("last_reply_at", { ascending: false });
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Support</h1>
        <LinkButton href="/portal/tickets/new"><Plus className="h-4 w-4" /> New ticket</LinkButton>
      </div>
      {!data?.length ? (
        <Card><EmptyState icon={LifeBuoy} title="No tickets yet" description="Need help? Open a ticket and our team will reply here." /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {data.map((t) => {
              const st = ticketStatus(t.status);
              const label = t.status === "answered" ? "Awaiting your reply" : t.status === "open" ? "With our team" : st.label;
              return (
                <li key={t.id}>
                  <Link href={`/portal/tickets/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-brand-50/40">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{t.subject}</div>
                      <div className="text-xs text-slate-500"><span className="font-mono">{ticketNumber(t.id)}</span> · <span suppressHydrationWarning>updated {timeAgo(t.last_reply_at)}</span></div>
                    </div>
                    <Badge className={st.color}>{label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
