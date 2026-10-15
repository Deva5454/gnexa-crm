import Link from "next/link";
import { FileSignature, FolderKanban, LifeBuoy, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { contractNumber, contractState, projectStatus, ticketNumber, ticketStatus } from "@/lib/constants";
import { formatDate, formatMoney, timeAgo } from "@/lib/utils";

/** Customer → "Projects & support" tab: their projects, contracts and tickets. */
export async function CustomerWork({ customerId }: { customerId: number }) {
  const { supabase, can } = await requireStaff();
  const [{ data: projects }, { data: contracts }, { data: tickets }] = await Promise.all([
    can("projects", "view") ? supabase.from("projects").select("id, name, status, deadline").eq("customer_id", customerId).order("created_at", { ascending: false }) : Promise.resolve({ data: null }),
    can("contracts", "view") ? supabase.from("contracts").select("id, subject, status, start_date, end_date, value").eq("customer_id", customerId).order("end_date", { ascending: false }) : Promise.resolve({ data: null }),
    can("support", "view") ? supabase.from("tickets").select("id, subject, status, last_reply_at").eq("customer_id", customerId).order("last_reply_at", { ascending: false }).limit(20) : Promise.resolve({ data: null }),
  ]);
  const Empty = ({ icon: Icon, text }: { icon: typeof LifeBuoy; text: string }) => (
    <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400"><Icon className="h-4 w-4" /> {text}</div>
  );
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {projects && (
        <Card>
          <CardHeader title="Projects" action={can("projects", "edit") && <LinkButton href={`/projects/new?customer=${customerId}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Project</LinkButton>} />
          {!projects.length ? <Empty icon={FolderKanban} text="No projects yet." /> : (
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => { const s = projectStatus(p.status); return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/projects/${p.id}`} className="font-medium text-slate-800 hover:text-brand-700">{p.name}</Link>
                  <span className="flex items-center gap-3"><span className="text-xs text-slate-500">{formatDate(p.deadline)}</span><Badge className={s.color}>{s.label}</Badge></span>
                </li>
              ); })}
            </ul>
          )}
        </Card>
      )}
      {contracts && (
        <Card>
          <CardHeader title="Contracts" action={can("contracts", "edit") && <LinkButton href={`/contracts/new?customer=${customerId}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Contract</LinkButton>} />
          {!contracts.length ? <Empty icon={FileSignature} text="No contracts yet." /> : (
            <ul className="divide-y divide-slate-100">
              {contracts.map((c) => { const s = contractState(c); return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/contracts/${c.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-brand-700">{c.subject} <span className="font-mono text-[11px] text-slate-400">{contractNumber(c.id)}</span></Link>
                  <span className="flex shrink-0 items-center gap-3"><span className="text-xs text-slate-500">{c.value != null ? formatMoney(Number(c.value)) : ""}</span><Badge className={s.color}>{s.label}</Badge></span>
                </li>
              ); })}
            </ul>
          )}
        </Card>
      )}
      {tickets && (
        <Card className="xl:col-span-2">
          <CardHeader title="Support tickets" action={can("support", "edit") && <LinkButton href={`/support/new?customer=${customerId}`} size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Ticket</LinkButton>} />
          {!tickets.length ? <Empty icon={LifeBuoy} text="No tickets." /> : (
            <ul className="divide-y divide-slate-100">
              {tickets.map((t) => { const s = ticketStatus(t.status); return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/support/${t.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-brand-700"><span className="font-mono text-[11px] text-slate-400">{ticketNumber(t.id)}</span> {t.subject}</Link>
                  <span className="flex shrink-0 items-center gap-3"><span className="text-xs text-slate-500" suppressHydrationWarning>{timeAgo(t.last_reply_at)}</span><Badge className={s.color}>{s.label}</Badge></span>
                </li>
              ); })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
