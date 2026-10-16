import type { Metadata } from "next";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { RecordTags } from "@/components/crm/tags";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, Download, Mail, Paperclip, Pencil, Phone, PhoneCall, Trash2, UserCheck, XCircle } from "lucide-react";
import { FileUploader } from "@/components/crm/file-uploader";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { NotesPanel } from "@/components/crm/notes-panel";
import { RelatedTasks } from "@/components/crm/related-tasks";
import { RelatedDocs } from "@/components/sales/related-docs";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ColorBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { convertLead, deleteLead, deleteLeadFile, markContacted, recordLeadFile, setLeadFlag } from "../actions";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  const canEdit = can("leads", "edit");
  const canConvert = canEdit && can("customers", "edit");
  const [{ data: l }, { data: settings }] = await Promise.all([
    supabase
      .from("leads")
      .select("*, source:lead_sources(name), status:lead_statuses(name, color), assignee:profiles!leads_assigned_to_fkey(full_name), customer:customers!leads_converted_customer_id_fkey(id, company)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("company_settings").select("currency").maybeSingle(),
  ]);
  if (!l) notFound();

  // Perfex warns when another lead or a customer contact already uses this e-mail or phone
  // keep characters that are safe inside a PostgREST or() filter
  const clean = (v: string | null) => (v ?? "").replace(/[,()"\\%*]/g, "").trim();
  const email = clean(l.email);
  const phone = clean(l.phone);
  const match = [email && `email.ilike.${email}`, phone && `phone.eq.${phone}`].filter(Boolean).join(",");
  const [{ data: files }, { data: dupLeads }, { data: dupContacts }] = await Promise.all([
    supabase.from("lead_files").select("id, name, size, created_at, uploader:profiles!lead_files_uploaded_by_fkey(full_name)").eq("lead_id", id).order("created_at", { ascending: false }),
    match ? supabase.from("leads").select("id, name").or(match).neq("id", id).limit(5) : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    match && can("customers", "view")
      ? supabase.from("contacts").select("id, first_name, last_name, customer_id").or(match).limit(5)
      : Promise.resolve({ data: [] as { id: number; first_name: string; last_name: string | null; customer_id: number }[] }),
  ]);
  const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

  const flagForm = (flag: "is_lost" | "is_junk", on: boolean, label: string, Icon: typeof Ban) => (
    <form action={setLeadFlag}>
      <input type="hidden" name="id" value={l.id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={on ? "0" : "1"} />
      <Button variant="secondary" size="sm"><Icon className="h-3.5 w-3.5" /> {on ? `Unmark ${label}` : `Mark ${label}`}</Button>
    </form>
  );

  const details: [string, React.ReactNode][] = [
    ["Company", l.company],
    ["Position", l.title],
    ["Email", l.email && <a href={`mailto:${l.email}`} className="text-brand-700">{l.email}</a>],
    ["Phone", l.phone && <a href={`tel:${l.phone}`} className="text-brand-700">{l.phone}</a>],
    ["Website", l.website],
    ["Address", [l.address, l.city, l.state, l.zip, l.country].filter(Boolean).join(", ") || null],
    ["Source", l.source?.name],
    ["Created", formatDate(l.created_at)],
    ["Last contact", l.last_contact_at ? formatDateTime(l.last_contact_at) : null],
  ];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/leads" className="hover:text-brand-600">Leads</Link>}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {l.name}
            {l.status && <ColorBadge color={l.status.color}>{l.status.name}</ColorBadge>}
            {l.is_lost && <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Lost</Badge>}
            {l.is_junk && <Badge className="bg-slate-800 text-white ring-slate-800">Junk</Badge>}
          </span>
        }
        actions={
          <>
            {canConvert && !l.converted_customer_id && (
              <form action={convertLead}>
                <input type="hidden" name="id" value={l.id} />
                <SubmitButton variant="accent" size="sm" pendingText="Converting…">
                  <UserCheck className="h-3.5 w-3.5" /> Convert to customer
                </SubmitButton>
              </form>
            )}
            {canEdit && (
              <form action={markContacted}>
                <input type="hidden" name="id" value={l.id} />
                <SubmitButton variant="secondary" size="sm" pendingText="Saving…"><PhoneCall className="h-3.5 w-3.5" /> Contacted today</SubmitButton>
              </form>
            )}
            {canEdit && flagForm("is_lost", l.is_lost, "lost", XCircle)}
            {canEdit && flagForm("is_junk", l.is_junk, "junk", Ban)}
            {canEdit && (
              <LinkButton href={`/leads/${id}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>
            )}
            {can("leads", "full") && (
              <ConfirmForm action={deleteLead} message={`Delete lead ${l.name}?`}>
                <input type="hidden" name="id" value={l.id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete lead"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </>
        }
      />
      <div className="-mt-3 mb-5"><RecordTags relType="lead" relId={id} path={`/leads/${id}`} canEdit={canEdit} /></div>

      {l.customer && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          Converted to customer{" "}
          <Link href={`/customers/${l.customer.id}`} className="font-semibold underline">{l.customer.company}</Link>
          {l.converted_at && <span className="text-emerald-600">on {formatDate(l.converted_at)}</span>}
        </div>
      )}

      {((dupLeads?.length ?? 0) > 0 || (dupContacts?.length ?? 0) > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <span className="font-medium">Possible duplicate — same e-mail or phone as:</span>
          {dupLeads?.map((d) => <Link key={`l${d.id}`} href={`/leads/${d.id}`} className="font-semibold underline">lead {d.name}</Link>)}
          {dupContacts?.map((c) => (
            <Link key={`c${c.id}`} href={`/customers/${c.customer_id}`} className="font-semibold underline">contact {[c.first_name, c.last_name].filter(Boolean).join(" ")}</Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Deal value</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(l.value, settings?.currency ?? "INR")}</div>
            </Card>
            <Card className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Owner</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                {l.assignee ? <><Avatar name={l.assignee.full_name} className="h-7 w-7" />{l.assignee.full_name}</> : <span className="text-slate-400">Unassigned</span>}
              </div>
            </Card>
            <Card className="flex items-center gap-2 px-5 py-4">
              {l.email && <LinkButton href={`mailto:${l.email}`} variant="secondary" size="sm"><Mail className="h-3.5 w-3.5" /> Email</LinkButton>}
              {l.phone && <LinkButton href={`tel:${l.phone}`} variant="secondary" size="sm"><Phone className="h-3.5 w-3.5" /> Call</LinkButton>}
              {!l.email && !l.phone && <span className="text-sm text-slate-400">No contact details</span>}
            </Card>
          </div>
          <NotesPanel relType="lead" relId={id} path={`/leads/${id}`} />
          <RelatedTasks relType="lead" relId={id} />
          <RelatedDocs leadId={id} />
          <Card>
            <CardHeader title="Attachments" description={files?.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : undefined} />
            <CardBody className="space-y-3">
              {(files ?? []).length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {files!.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <a href={`/leads/files/${f.id}`} className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-brand-700">{f.name}</a>
                      <span className="hidden text-xs text-slate-400 sm:inline">{kb(Number(f.size))} · {f.uploader?.full_name?.split(" ")[0] ?? "—"} · {formatDate(f.created_at)}</span>
                      <a href={`/leads/files/${f.id}`} className="rounded p-1 text-slate-400 hover:text-brand-700" aria-label={`Download ${f.name}`}><Download className="h-4 w-4" /></a>
                      {canEdit && (
                        <ConfirmForm action={deleteLeadFile} message={`Delete ${f.name}?`}>
                          <input type="hidden" name="id" value={f.id} />
                          <button className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={`Delete ${f.name}`}><Trash2 className="h-4 w-4" /></button>
                        </ConfirmForm>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit ? <FileUploader bucket="lead-files" relId={id} record={recordLeadFile} /> : !files?.length && <p className="text-sm text-slate-400">No files.</p>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Lead information" />
            <CardBody>
              <dl className="space-y-4">
                {details.map(([k, v]) => (
                  <div key={k}>
                    <dt className="label">{k}</dt>
                    <dd className="text-sm text-slate-700">{v || <span className="text-slate-400">—</span>}</dd>
                  </div>
                ))}
              </dl>
              {l.description && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <div className="label">Description</div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{l.description}</p>
                </div>
              )}
            </CardBody>
          </Card>
          <CustomFieldsCard entity="lead" relId={id} path={`/leads/${id}`} />
          <RemindersPanel relType="lead" relId={id} path={`/leads/${id}`} />
          <Card>
            <CardHeader title="Activity" />
            <ActivityFeed relType="lead" relId={id} limit={15} />
          </Card>
        </div>
      </div>
    </>
  );
}
