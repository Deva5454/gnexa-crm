import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Paperclip } from "lucide-react";
import { FileUploader } from "@/components/crm/file-uploader";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requirePortal } from "@/lib/auth";
import { ticketNumber, ticketStatus } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { closeTicketPortal, recordPortalTicketFile } from "../../actions";
import { TicketReply } from "../../forms";

export const metadata: Metadata = { title: "Ticket" };

export default async function PortalTicket({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase } = await requirePortal();
  const [{ data: t }, { data: replies }, { data: settings }, { data: files }] = await Promise.all([
    supabase.from("tickets").select("id, subject, status, created_at").eq("id", id).maybeSingle(),
    // Internal notes are filtered out by the database for clients
    supabase.from("ticket_replies").select("id, body, author_id, author_name, created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("company_settings").select("company_name").maybeSingle(),
    // Files on internal notes are hidden by the database
    supabase.from("ticket_files").select("id, name, from_customer").eq("ticket_id", id).order("created_at"),
  ]);
  if (!t) notFound();
  const st = ticketStatus(t.status);
  const team = `${settings?.company_name ?? "Our"} team`;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/portal/tickets" className="mb-5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Support</Link>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.subject}</h1><Badge className={st.color}>{st.label}</Badge></div>
        <p className="text-sm text-slate-500"><span className="font-mono">{ticketNumber(id)}</span> · opened {formatDateTime(t.created_at)}</p>
      </div>
      <ol className="mb-6 space-y-4">
        {(replies ?? []).map((r) => {
          const mine = !r.author_id;
          const who = mine ? (r.author_name ?? "You") : team;
          return (
            <li key={r.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <Avatar name={who} className="mt-1" />
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-card", mine ? "bg-brand-600 text-white" : "border border-slate-200 bg-white")}>
                <div className={cn("mb-1 text-xs", mine ? "text-brand-100" : "text-slate-500")}><b>{who}</b> · {formatDateTime(r.created_at)}</div>
                <p className="whitespace-pre-wrap leading-relaxed">{r.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {(files ?? []).length > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Attachments</h2>
          <ul className="flex flex-wrap gap-2">
            {(files ?? []).map((f) => (
              <li key={f.id}>
                <a href={`/portal/tickets/files/${f.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-200">
                  <Paperclip className="h-3.5 w-3.5" /> {f.name} <span className="text-slate-400">· {f.from_customer ? "you" : team}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <TicketReply id={id} />
      {t.status !== "closed" && (
        <div className="mt-3">
          <FileUploader bucket="ticket-files" relId={id} record={recordPortalTicketFile} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {t.status === "closed" ? (
          <p className="text-xs text-slate-400">This ticket is closed — replying will re-open it.</p>
        ) : (
          <>
            <p className="text-xs text-slate-400">Problem solved? Close the ticket — you can always reply to re-open it.</p>
            <form action={closeTicketPortal}>
              <input type="hidden" name="id" value={id} />
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> Close ticket
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
