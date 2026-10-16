import type { Metadata } from "next";
import { UnbilledExpenses } from "@/components/sales/unbilled-expenses";
import { CustomFieldsCard } from "@/components/crm/custom-fields-card";
import { EmailHistory } from "@/components/crm/email-history";
import { CustomerSubscriptions } from "@/components/sales/customer-subscriptions";
import { RecordTags } from "@/components/crm/tags";
import { RemindersPanel } from "@/components/crm/reminders-panel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Mail, MapPin, Pencil, Phone, Star, Trash2, Download } from "lucide-react";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { NotesPanel } from "@/components/crm/notes-panel";
import { RelatedTasks } from "@/components/crm/related-tasks";
import { RelatedDocs } from "@/components/sales/related-docs";
import { CustomerWork } from "@/components/crm/customer-work";
import { PortalAccess } from "@/components/crm/portal-access";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { deleteContact, deleteCustomer, makePrimaryContact, toggleCustomerActive } from "../actions";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const id = Number((await params).id);
  const tab = (await searchParams).tab ?? "profile";
  const { supabase, can, profile } = await requireStaff();
  const canEdit = can("customers", "edit");
  const canDelete = can("customers", "full");

  const [{ data: c }, { data: contacts }, notesCount, tasksCount, { data: lead }] = await Promise.all([
    supabase.from("customers").select("*, group:customer_groups(name)").eq("id", id).maybeSingle(),
    supabase.from("contacts").select("*").eq("customer_id", id).order("is_primary", { ascending: false }).order("first_name"),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("rel_type", "customer").eq("rel_id", id),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("rel_type", "customer").eq("rel_id", id),
    supabase.from("leads").select("id, name").eq("converted_customer_id", id).maybeSingle(),
  ]);
  if (!c) notFound();

  const base = `/customers/${id}`;
  const tabs = [
    { key: "profile", label: "Profile", href: base },
    { key: "contacts", label: "Contacts", href: `${base}?tab=contacts`, count: contacts?.length ?? 0 },
    { key: "notes", label: "Notes", href: `${base}?tab=notes`, count: notesCount.count ?? 0 },
    { key: "tasks", label: "Tasks", href: `${base}?tab=tasks`, count: tasksCount.count ?? 0 },
    ...(can("sales", "view") ? [{ key: "billing", label: "Billing", href: `${base}?tab=billing` }] : []),
    ...(can("projects", "view") || can("support", "view") || can("contracts", "view") ? [{ key: "work", label: "Projects & support", href: `${base}?tab=work` }] : []),
    { key: "activity", label: "Activity", href: `${base}?tab=activity` },
  ];

  const address = [c.address, c.city, c.state, c.zip, c.country].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/customers" className="hover:text-brand-600">Customers</Link>}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.company} className="h-10 w-10 rounded-xl text-sm" />
            {c.company}
            <Badge className={c.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}>
              {c.is_active ? "Active" : "Inactive"}
            </Badge>
          </span>
        }
        actions={
          <>
            {canEdit && (
            <form action={toggleCustomerActive}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.is_active ? "0" : "1"} />
              <Button variant="secondary" size="sm">Mark {c.is_active ? "inactive" : "active"}</Button>
            </form>
            )}
            {canEdit && (
              <LinkButton href={`${base}/edit`} variant="secondary" size="sm">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </LinkButton>
            )}
            {canDelete && (
            <ConfirmForm action={deleteCustomer} message={`Delete ${c.company}? Contacts, notes and linked tasks are deleted too.`}>
              <input type="hidden" name="id" value={c.id} />
              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </ConfirmForm>
            )}
          </>
        }
      />

      <div className="-mt-3 mb-5"><RecordTags relType="customer" relId={id} path={base} canEdit={canEdit} /></div>
      <Tabs tabs={tabs} active={tab} />

      {tab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Company details" />
            <CardBody>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {[
                  ["Phone", c.phone ? <a href={`tel:${c.phone}`} className="text-brand-700">{c.phone}</a> : null, Phone],
                  ["Website", c.website ? <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="text-brand-700">{c.website}</a> : null, Globe],
                  ["Address", address || null, MapPin],
                  ["GST / VAT", c.vat, null],
                  ["Group", c.group?.name, null],
                  ["Currency", c.currency, null],
                  ["Customer since", formatDate(c.created_at), null],
                  ["Source", lead ? <Link href={`/leads/${lead.id}`} className="text-brand-700">Converted lead · {lead.name}</Link> : "Added directly", null],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="label">{label as string}</dt>
                    <dd className="text-sm text-slate-700">{(value as React.ReactNode) ?? <span className="text-slate-400">—</span>}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
          <div className="space-y-6">
            <PortalAccess customerId={id} />
            <CustomFieldsCard entity="customer" relId={id} path={base} />
            <RemindersPanel relType="customer" relId={id} path={base} />
            <Card>
              <CardHeader title="Recent activity" />
              <ActivityFeed relType="customer" relId={id} limit={8} />
            </Card>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <Card>
          <CardHeader
            title="Contacts"
            description="People at this company"
            action={
              <div className="flex items-center gap-2">
                {profile.is_admin && (
                  <a href={`${base}/export`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50" title="GDPR data export (JSON)">
                    <Download className="h-3.5 w-3.5" /> Export data
                  </a>
                )}
                {canEdit && <ContactForm customerId={id} />}
              </div>
            }
          />
          {!contacts?.length ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No contacts yet.</p>
          ) : (
            <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.map((p) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
                return (
                  <li key={p.id} className="group relative rounded-xl border border-slate-200 p-4 hover:border-brand-200 hover:shadow-card">
                    <div className="flex items-start gap-3">
                      <Avatar name={name} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <span className="truncate">{name}</span>
                          {p.is_primary && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Primary" />}
                        </div>
                        {p.title && <div className="text-xs text-slate-500">{p.title}</div>}
                        <div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-medium ${p.marketing_consent ? "text-emerald-600" : "text-slate-400"}`} title={p.consent_updated_at ? `Updated ${formatDate(p.consent_updated_at)}` : undefined}>
                          {p.marketing_consent ? "✓ Marketing consent" : "No marketing consent"}
                        </div>
                        <div className="mt-2 space-y-1 text-sm">
                          {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-2 truncate text-slate-600 hover:text-brand-700"><Mail className="h-3.5 w-3.5" />{p.email}</a>}
                          {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-brand-700"><Phone className="h-3.5 w-3.5" />{p.phone}</a>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 text-xs">
                      {canEdit && !p.is_primary && (
                        <form action={makePrimaryContact}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="customer_id" value={id} />
                          <button className="font-medium text-slate-500 hover:text-brand-700">Make primary</button>
                        </form>
                      )}
                      {canDelete && (
                        <ConfirmForm action={deleteContact} message={`Remove ${name}?`} className="ml-auto">
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="customer_id" value={id} />
                          <button className="font-medium text-slate-400 hover:text-rose-600">Remove</button>
                        </ConfirmForm>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "notes" && <NotesPanel relType="customer" relId={id} path={base} />}
      {tab === "tasks" && <RelatedTasks relType="customer" relId={id} />}
      {tab === "billing" && (
        <div className="space-y-6">
          <UnbilledExpenses customerId={id} />
          <RelatedDocs customerId={id} />
          <div className="grid gap-6 lg:grid-cols-2">
            <CustomerSubscriptions customerId={id} />
            <EmailHistory customerId={id} limit={10} />
          </div>
        </div>
      )}
      {tab === "work" && <CustomerWork customerId={id} />}
      {tab === "activity" && (
        <Card>
          <CardHeader title="Activity log" />
          <ActivityFeed relType="customer" relId={id} limit={50} />
        </Card>
      )}
    </>
  );
}
