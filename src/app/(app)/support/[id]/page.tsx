import type { Metadata } from "next";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { RecordTags } from "@/components/crm/tags";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Lock, Mail, Phone, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { taskPriority, ticketNumber, ticketStatus } from "@/lib/constants";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { deleteTicket } from "../actions";
import { TicketProperties } from "./properties";
import { ReplyBox } from "./reply-box";

export const metadata: Metadata = { title: "Ticket" };

const STOP = new Set(["the", "a", "an", "to", "for", "on", "in", "of", "and", "is", "not", "how", "do", "i", "we", "our", "my", "with", "can", "be"]);

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can, profile } = await requireStaff();
  if (!can("support", "view")) notFound();
  const [{ data: t }, { data: replies }, { data: departments }, { data: staff }, { data: canned }] = await Promise.all([
    supabase
      .from("tickets")
      .select("*, customer:customers(id, company), contact:contacts(first_name, last_name, email, phone), department:ticket_departments(name), assignee:profiles!tickets_assigned_to_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ticket_replies").select("id, body, is_internal, author_name, created_at, author:profiles(full_name)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("predefined_replies").select("id, title, body").order("title"),
  ]);
  if (!t) notFound();
  const { data: projects } = t.customer_id
    ? await supabase.from("projects").select("id, name").eq("customer_id", t.customer_id).order("name")
    : { data: [] as { id: number; name: string }[] };

  // Suggested help articles: title words overlapping the subject
  const words = t.subject.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  const { data: articles } = words.length
    ? await supabase.from("kb_articles").select("id, title, slug").eq("is_published", true).or(words.slice(0, 6).map((w) => `title.ilike.%${w}%`).join(",")).limit(4)
    : { data: [] as { id: number; title: string; slug: string }[] };

  const st = ticketStatus(t.status);
  const pr = taskPriority(t.priority);
  const contactName = t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : "";
  const canEdit = can("support", "edit");

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/support" className="hover:text-brand-600">Support</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{t.subject}<Badge className={st.color}>{st.label}</Badge></span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{ticketNumber(id)}</span> · <span className={cn("font-semibold", pr.color)}>{pr.label} priority</span> · opened {formatDateTime(t.created_at)}
          </span>
        }
        actions={
          can("support", "full") && (
            <ConfirmForm action={deleteTicket} message={`Delete ticket ${ticketNumber(id)} and its conversation?`}>
              <input type="hidden" name="id" value={id} />
              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </ConfirmForm>
          )
        }
      />
      <div className="-mt-3 mb-5"><RecordTags relType="ticket" relId={id} path={`/support/${id}`} canEdit={can("support", "edit")} /></div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <ol className="space-y-4">
            {(replies ?? []).map((r) => {
              const fromCustomer = !r.author && !!r.author_name;
              const who = r.author?.full_name ?? r.author_name ?? "Unknown";
              return (
                <li key={r.id} className={cn("flex gap-3", !fromCustomer && "flex-row-reverse")}>
                  <Avatar name={who} className="mt-1" />
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-card",
                      r.is_internal ? "border border-amber-200 bg-amber-50" : fromCustomer ? "border border-slate-200 bg-white" : "bg-brand-600 text-white",
                    )}
                  >
                    <div className={cn("mb-1 flex items-center gap-2 text-xs", r.is_internal ? "text-amber-700" : fromCustomer ? "text-slate-500" : "text-brand-100")}>
                      <b>{who}</b>
                      {fromCustomer && <span>· customer</span>}
                      {r.is_internal && <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> internal note</span>}
                      <span suppressHydrationWarning>· {timeAgo(r.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {canEdit && <ReplyBox ticketId={id} contactName={contactName} agentName={profile.full_name} replies={canned ?? []} />}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Requester" />
            <CardBody className="space-y-2 text-sm">
              {t.customer ? <Link href={`/customers/${t.customer.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{t.customer.company}</Link> : <span className="text-slate-400">No customer</span>}
              {contactName && <div className="text-slate-700">{contactName}</div>}
              {t.contact?.email && <a href={`mailto:${t.contact.email}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700"><Mail className="h-3.5 w-3.5" />{t.contact.email}</a>}
              {t.contact?.phone && <a href={`tel:${t.contact.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700"><Phone className="h-3.5 w-3.5" />{t.contact.phone}</a>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Properties" description={canEdit ? "Changes save instantly" : undefined} />
            <CardBody>
              <TicketProperties ticket={t} departments={departments ?? []} staff={staff ?? []} projects={projects ?? []} disabled={!canEdit} />
            </CardBody>
          </Card>
          <CustomFieldsCard entity="ticket" relId={id} path={`/support/${id}`} />
          <RemindersPanel relType="ticket" relId={id} path={`/support/${id}`} />
          {can("knowledge_base", "view") && (articles?.length ?? 0) > 0 && (
            <Card>
              <CardHeader title="Suggested articles" description="Share a link in your reply" />
              <ul className="divide-y divide-slate-100">
                {articles!.map((a) => (
                  <li key={a.id}>
                    <Link href={`/knowledge-base/${a.slug}`} className="flex items-center gap-2 px-5 py-2.5 text-sm text-slate-700 hover:bg-brand-50/40 hover:text-brand-700">
                      <BookOpen className="h-4 w-4 shrink-0 text-brand-500" /> {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
