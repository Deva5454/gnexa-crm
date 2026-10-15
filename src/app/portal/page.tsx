import Link from "next/link";
import { ArrowRight, FileSignature, FileText, LifeBuoy, Megaphone, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { projectStatus } from "@/lib/constants";
import { docNumber, docStatus } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export default async function PortalHome() {
  const { supabase, contactName, company } = await requirePortal();
  const [{ data: docs }, { data: contracts }, { data: tickets }, { data: projects }, { data: tasks }, { data: news }] = await Promise.all([
    supabase.from("sales_docs").select("id, kind, number, status, due_date, total, date, subject").order("date", { ascending: false }),
    supabase.from("contracts").select("id, subject, status"),
    supabase.from("tickets").select("id, status"),
    supabase.from("projects").select("id, name, status, deadline"),
    supabase.from("tasks").select("rel_id, status"),
    supabase.from("announcements").select("id, title, body, created_at").eq("show_to_clients", true).order("created_at", { ascending: false }).limit(2),
  ]);
  const bals = await balancesFor(supabase, (docs ?? []).map((d) => d.id));
  const invoices = (docs ?? []).filter((d) => d.kind === "invoice").map((d) => ({ ...d, st: docStatus({ kind: "invoice", status: d.status, due_date: d.due_date, total: Number(d.total) }, bals.get(d.id)), bal: bals.get(d.id) }));
  const outstanding = invoices.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Math.max(0, i.bal?.balance ?? 0), 0);
  const overdue = invoices.filter((i) => i.st.key === "overdue").reduce((s, i) => s + (i.bal?.balance ?? 0), 0);
  const quotesWaiting = (docs ?? []).filter((d) => (d.kind === "estimate" || d.kind === "proposal") && d.status === "sent").length;
  const toSign = (contracts ?? []).filter((c) => c.status === "sent").length;
  const openTickets = (tickets ?? []).filter((t) => t.status !== "closed").length;

  const tiles = [
    { label: "Balance due", value: formatMoney(outstanding), sub: overdue > 0 ? `${formatMoney(overdue)} overdue` : "Nothing overdue", icon: ReceiptText, href: "/portal/invoices", warn: overdue > 0 },
    { label: "Quotes to review", value: String(quotesWaiting), sub: "estimates & proposals", icon: FileText, href: "/portal/quotes", warn: quotesWaiting > 0 },
    { label: "Contracts to sign", value: String(toSign), sub: `${(contracts ?? []).length} in total`, icon: FileSignature, href: "/portal/contracts", warn: toSign > 0 },
    { label: "Open tickets", value: String(openTickets), sub: "we're on it", icon: LifeBuoy, href: "/portal/tickets", warn: false },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back, {contactName.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">Everything between {company} and us, in one place.</p>
      </div>

      {(news ?? []).map((n) => (
        <div key={n.id} className="mb-6 flex gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-5 py-4">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">{n.title}</div>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
          </div>
        </div>
      ))}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group">
            <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
              <t.icon className="h-5 w-5 text-brand-500" />
              <div className="mt-3 text-xs font-medium text-slate-500">{t.label}</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900">{t.value}</div>
              <div className={cn("text-xs", t.warn ? "font-semibold text-amber-600" : "text-slate-400")}>{t.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent invoices" action={<Link href="/portal/invoices" className="flex items-center gap-1 text-xs font-semibold text-brand-600">All <ArrowRight className="h-3 w-3" /></Link>} />
          <ul className="divide-y divide-slate-100">
            {invoices.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Link href={`/portal/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-brand-50/40">
                  <span><span className="font-mono font-semibold text-brand-700">{docNumber("invoice", i.number)}</span><span className="ml-2 text-slate-500">{formatDate(i.date)}</span></span>
                  <span className="flex items-center gap-3"><b>{formatMoney(Number(i.total))}</b><Badge className={i.st.color}>{i.st.label}</Badge></span>
                </Link>
              </li>
            ))}
            {!invoices.length && <li className="px-5 py-6 text-sm text-slate-400">No invoices yet.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Your projects" action={<Link href="/portal/projects" className="flex items-center gap-1 text-xs font-semibold text-brand-600">All <ArrowRight className="h-3 w-3" /></Link>} />
          <ul className="divide-y divide-slate-100">
            {(projects ?? []).map((p) => {
              const ts = (tasks ?? []).filter((t) => t.rel_id === p.id);
              const pct = ts.length ? Math.round((ts.filter((t) => t.status === "complete").length / ts.length) * 100) : 0;
              const s = projectStatus(p.status);
              return (
                <li key={p.id}>
                  <Link href={`/portal/projects/${p.id}`} className="block px-5 py-3 hover:bg-brand-50/40">
                    <div className="flex items-center justify-between text-sm"><span className="font-medium text-slate-800">{p.name}</span><Badge className={s.color}>{s.label}</Badge></div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-400" style={{ width: `${pct}%` }} /></div>
                      <span className="text-xs font-semibold text-slate-600">{pct}%</span>
                    </div>
                  </Link>
                </li>
              );
            })}
            {!projects?.length && <li className="px-5 py-6 text-sm text-slate-400">No projects yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
