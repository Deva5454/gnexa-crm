import type { Metadata } from "next";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { RecordTags } from "@/components/crm/tags";
import { RelatedTasks } from "@/components/crm/related-tasks";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ListPlus, Lock, Mail, Merge, Paperclip, Pencil, Phone, Trash2 } from "lucide-react";
import { FileUploader } from "@/components/crm/file-uploader";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { taskPriority, ticketNumber, ticketStatus } from "@/lib/constants";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { deleteReply, deleteTicket, deleteTicketFile, editReply, mergeInto, recordTicketFile } from "../actions";
import { TicketProperties } from "./properties";
import { ReplyBox } from "./reply-box";

export const metadata: Metadata = { title: "Ticket" };

const STOP = new Set(["the", "a", "an", "to", "for", "on", "in", "of", "and", "is", "not", "how", "do", "i", "we", "our", "my", "with", "can", "be"]);

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can, profile } = await requireStaff();
  if (!can("support", "view")) notFound();
  const [{ data: t }, { data: replies }, { data: departments }, { data: staff }, { data: canned }, { data: services }, { data: files }] = await Promise.all([
    supabase
      .from("tickets")
      .select("*, customer:customers(id, company), contact:contacts(first_name, last_name, email, phone), department:ticket_departments(name), assignee:profiles!tickets_assigned_to_fkey(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ticket_replies").select("id, body, is_internal, author_id, author_name, created_at, edited_at, author:profiles(full_name)").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    supabase.from("predefined_replies").select("id, title, body").order("title"),
    supabase.from("ticket_services").select("id, name").order("name"),
    supabase.from("ticket_files").select("id, name, size, reply_id, from_customer, uploaded_by, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  if (!t) notFound();
  const none = { data: [] as never[] };
  const [{ data: projects }, { data: others }, { data: merged }] = await Promise.all([
    t.customer_id ? supabase.from("projects").select("id, name").eq("customer_id", t.customer_id).order("name") : none,
    // Other tickets from the same customer (for context and for merging)
    t.customer_id ? supabase.from("tickets").select("id, subject, status, last_reply_at").eq("customer_id", t.customer_id).neq("id", id).order("last_reply_at", { ascending: false }).limit(20) : none,
    t.merged_into ? supabase.from("tickets").select("id, subject").eq("id", t.merged_into).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const filesOf = (replyId: number | null) => (files ?? []).filter((f) => f.reply_id === replyId);

  // Suggested help articles: title words overlapping the subject
  const words = t.subject.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  const { data: articles } = words.length
    ? await supabase.from("kb_articles").select("id, title, slug").eq("is_published", true).or(words.slice(0, 6).map((w) => `title.ilike.%${w}%`).join(",")).limit(4)
    : { data: [] as { id: number; title: string; slug: string }[] };

  const st = ticketStatus(t.status);
  const pr = taskPriority(t.priority);
  const contactName = t.contact ? [t.contact.first_name, t.contact.last_name].filter(Boolean).join(" ") : "";
  const canEdit = can("support", "edit");
  const canFull = can("support", "full");
  const mergeable = (others ?? []).filter((o) => o.status !== "closed");

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
      {merged && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Merge className="h-4 w-4" /> This ticket was merged into
          <Link href={`/support/${merged.id}`} className="font-semibold underline">{ticketNumber(merged.id)} {merged.subject}</Link>
        </div>
      )}
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
                    {filesOf(r.id).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {filesOf(r.id).map((f) => (
                          <a key={f.id} href={`/support/files/${f.id}`} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs", !fromCustomer && !r.is_internal ? "bg-white/15 text-white hover:bg-white/25" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
                            <Paperclip className="h-3 w-3" /> {f.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {r.edited_at && <div className={cn("mt-1 text-[11px] italic", !fromCustomer && !r.is_internal ? "text-brand-100" : "text-slate-400")}>edited</div>}
                  </div>
                  {canEdit && (
                    <div className="mt-1 flex shrink-0 flex-col items-center gap-1 self-start pt-1">
                      <Link
                        href={`/tasks/new?rel_type=ticket&rel_id=${id}&name=${encodeURIComponent(`${ticketNumber(id)}: ${t.subject}`.slice(0, 200))}&description=${encodeURIComponent(r.body.slice(0, 1500))}`}
                        title="Convert to task"
                        aria-label="Convert this reply to a task"
                        className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-brand-600"
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                      </Link>
                      {(r.author_id === profile.id || canFull) && (
                        <>
                          <details className="relative">
                            <summary className="list-none cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600" title="Edit" aria-label="Edit this reply"><Pencil className="h-3.5 w-3.5" /></summary>
                            <form action={editReply} className={cn("absolute top-7 z-10 w-80 max-w-[80vw] space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg", fromCustomer ? "left-0" : "right-0")}>
                              <input type="hidden" name="id" value={r.id} />
                              <textarea name="body" defaultValue={r.body} rows={5} required aria-label="Reply text" className="field text-sm" />
                              <Button size="sm">Save</Button>
                            </form>
                          </details>
                          <ConfirmForm action={deleteReply} message="Delete this reply and its attachments?">
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600" title="Delete" aria-label="Delete this reply"><Trash2 className="h-3.5 w-3.5" /></button>
                          </ConfirmForm>
                        </>
                      )}
                    </div>
                  )}
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
              <TicketProperties ticket={t} departments={departments ?? []} services={services ?? []} staff={staff ?? []} projects={projects ?? []} disabled={!canEdit} />
            </CardBody>
          </Card>
          <CustomFieldsCard entity="ticket" relId={id} path={`/support/${id}`} />
          <RemindersPanel relType="ticket" relId={id} path={`/support/${id}`} />
          <Card>
            <CardHeader title="Attachments" description="Shared with the customer in the portal" />
            <CardBody className="space-y-3">
              {(files ?? []).length > 0 && (
                <ul className="divide-y divide-slate-100 text-sm">
                  {(files ?? []).map((f) => (
                    <li key={f.id} className="flex items-center gap-2 py-1.5">
                      <a href={`/support/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-700 hover:text-brand-700">{f.name}</a>
                      <span className="shrink-0 text-[11px] text-slate-400">{f.from_customer ? "customer" : (staffName.get(f.uploaded_by ?? "")?.split(" ")[0] ?? "staff")}</span>
                      {canEdit && (f.uploaded_by === profile.id || canFull) && (
                        <ConfirmForm action={deleteTicketFile} message={`Delete ${f.name}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="rounded p-0.5 text-slate-300 hover:text-rose-600" aria-label={`Delete ${f.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? <FileUploader bucket="ticket-files" relId={id} record={recordTicketFile} /> : !(files ?? []).length && <p className="text-sm text-slate-400">No files.</p>}
            </CardBody>
          </Card>
          <RelatedTasks relType="ticket" relId={id} compact />
          {(others ?? []).length > 0 && (
            <Card>
              <CardHeader title="Other tickets" description={t.customer?.company} />
              <ul className="divide-y divide-slate-100">
                {(others ?? []).slice(0, 8).map((o) => (
                  <li key={o.id}>
                    <Link href={`/support/${o.id}`} className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-brand-50/40">
                      <span className="min-w-0 flex-1 truncate text-slate-700">{o.subject}</span>
                      <Badge className={ticketStatus(o.status).color}>{ticketStatus(o.status).label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {canEdit && t.status !== "closed" && mergeable.length > 0 && (
            <Card>
              <CardHeader title="Merge tickets" description="Move other open tickets from this customer into this one. They close and point here." />
              <CardBody>
                <form action={mergeInto} className="space-y-2">
                  <input type="hidden" name="id" value={id} />
                  {mergeable.map((o) => (
                    <label key={o.id} className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="sources" value={o.id} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
                      <span className="min-w-0"><span className="font-mono text-xs text-slate-400">{ticketNumber(o.id)}</span> {o.subject}</span>
                    </label>
                  ))}
                  <Button size="sm" variant="secondary"><Merge className="h-3.5 w-3.5" /> Merge into this ticket</Button>
                </form>
              </CardBody>
            </Card>
          )}
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
