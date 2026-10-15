import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, Mail, Mails } from "lucide-react";
import { EMAIL_KIND } from "@/components/crm/email-history";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireStaff } from "@/lib/auth";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "E-mail log" };
const SIZE = 30;

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ kind?: string; who?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  let q = supabase
    .from("email_log")
    .select("id, to_email, to_name, subject, body, kind, automatic, created_at, rel_type, rel_id, customer:customers(id, company), sender:profiles!email_log_sent_by_fkey(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * SIZE, page * SIZE - 1);
  if (sp.kind && EMAIL_KIND[sp.kind]) q = q.eq("kind", sp.kind);
  if (sp.who === "auto") q = q.eq("automatic", true);
  if (sp.who === "staff") q = q.eq("automatic", false);
  const { data: rows, count } = await q;

  // Links to the documents the e-mails are about
  const docIds = (rows ?? []).filter((r) => r.rel_type === "sales_doc" && r.rel_id).map((r) => r.rel_id!);
  const { data: docs } = docIds.length ? await supabase.from("sales_docs").select("id, kind").in("id", docIds) : { data: [] };
  const slug = { proposal: "proposals", estimate: "estimates", invoice: "invoices", credit_note: "credit-notes" } as const;
  const docLink = (id: number) => {
    const d = docs?.find((x) => x.id === id);
    return d ? `/sales/${slug[d.kind]}/${id}` : null;
  };
  const href = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ kind: sp.kind, who: sp.who, ...patch })) if (v) n.set(k, v);
    return n.toString() ? `/emails?${n}` : "/emails";
  };
  const pill = (on: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", on ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");

  return (
    <>
      <PageHeader title="E-mail log" description="Everything Gnexa “sent” — by your team or automatically. This is a demo, so nothing actually leaves the building." />
      <Card>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-4">
          <Link href={href({ kind: undefined })} className={pill(!sp.kind)}>All</Link>
          {Object.entries(EMAIL_KIND).filter(([k]) => k !== "manual").map(([k, v]) => <Link key={k} href={href({ kind: k })} className={pill(sp.kind === k)}>{v.label}</Link>)}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <Link href={href({ who: sp.who === "auto" ? undefined : "auto" })} className={pill(sp.who === "auto")}>Automatic</Link>
          <Link href={href({ who: sp.who === "staff" ? undefined : "staff" })} className={pill(sp.who === "staff")}>Sent by staff</Link>
        </div>
        {!rows?.length ? (
          <EmptyState icon={Mails} title="No e-mails" description="Send an invoice or estimate by e-mail and it shows up here." />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {rows.map((e) => {
                const k = EMAIL_KIND[e.kind] ?? EMAIL_KIND.manual!;
                const link = e.rel_type === "sales_doc" && e.rel_id ? docLink(e.rel_id) : e.customer ? `/customers/${e.customer.id}` : null;
                return (
                  <li key={e.id}>
                    <details className="group px-5 py-3">
                      <summary className="flex cursor-pointer list-none items-start gap-3">
                        {e.automatic ? <Bot className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">{e.subject}</span>
                          <span className="block truncate text-xs text-slate-500" suppressHydrationWarning>
                            To {e.to_name ? `${e.to_name} <${e.to_email}>` : (e.to_email ?? "—")}
                            {e.customer && <> · {e.customer.company}</>} · {e.automatic ? "automatic" : (e.sender?.full_name ?? "staff")} · {formatDateTime(e.created_at)}
                          </span>
                        </span>
                        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", k.color)}>{k.label}</span>
                      </summary>
                      <div className="ml-7 mt-2 space-y-2">
                        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">{e.body}</p>
                        {link && <Link href={link} className="text-xs font-semibold text-brand-600 hover:text-brand-800">Open related record →</Link>}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageSize={SIZE} total={count ?? 0} basePath="/emails" params={{ kind: sp.kind, who: sp.who }} />
          </>
        )}
      </Card>
    </>
  );
}
