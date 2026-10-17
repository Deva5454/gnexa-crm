import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CalendarClock, CalendarX, CreditCard, Pause, Pencil, Play, ReceiptText, Trash2, Undo2 } from "lucide-react";
import { EmailHistory } from "@/components/crm/email-history";
import { SendEmailForm, type Recipient } from "@/components/crm/send-email-form";
import { renderTemplate } from "@/lib/email-templates";
import { todayIST } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireFeature, requireStaff } from "@/lib/auth";
import { docHref, docNumber, docStatus, INTERVAL_LABEL } from "@/lib/sales";
import { balancesFor, companySettings } from "@/lib/sales-data";
import { formatDate, formatMoney } from "@/lib/utils";
import { billNow, cancelAtPeriodEnd, deleteSubscription, sendSubscriptionEmail, setSubscriptionStatus } from "../actions";
import { monthly, SUB_STATUS, withTax } from "../status";

export const metadata: Metadata = { title: "Subscription" };

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("subscriptions"); // Setup → Modules
  const id = Number((await params).id);
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const [{ data: s }, { data: invoices }] = await Promise.all([
    supabase.from("subscriptions").select("*, customer:customers(id, company), project:projects(id, name), creator:profiles!subscriptions_created_by_fkey(full_name)").eq("id", id).maybeSingle(),
    supabase.from("sales_docs").select("id, number, date, due_date, status, total").eq("subscription_id", id).order("date", { ascending: false }),
  ]);
  if (!s) notFound();
  const bals = await balancesFor(supabase, (invoices ?? []).map((i) => i.id));
  const st = SUB_STATUS[s.status] ?? SUB_STATUS.active!;
  const canEdit = can("sales", "edit");
  const billed = (invoices ?? []).reduce((t, i) => t + Number(i.total), 0);
  const collected = (invoices ?? []).reduce((t, i) => t + (bals.get(i.id)?.paid ?? 0), 0);
  const live = s.status === "active" || s.status === "paused";
  const notStarted = s.status === "active" && s.cycles_billed === 0 && !!s.next_billing_date && s.next_billing_date > todayIST();

  // E-mail to the customer: their contacts with an address, and the "subscription details" template
  const { data: contacts } = await supabase.from("contacts").select("email, first_name, last_name").eq("customer_id", s.customer_id).not("email", "is", null).order("is_primary", { ascending: false });
  const recipients: Recipient[] = (contacts ?? []).map((c) => ({ email: c.email!, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null }));
  const company = await companySettings(supabase);
  const tpl = await renderTemplate(supabase, "subscription_send", {
    contact_name: (recipients[0]?.name ?? "").split(" ")[0] || "there",
    company_name: company?.company_name ?? "",
    plan: s.name,
    price: formatMoney(withTax(s), s.currency),
    interval: INTERVAL_LABEL(s.interval_count, s.interval_unit),
    next_billing: s.status === "active" && s.next_billing_date ? formatDate(s.next_billing_date) : "—",
  });

  const Action = ({ to, label, icon: Icon, confirm }: { to: string; label: string; icon: typeof Pause; confirm?: string }) => {
    const inner = (
      <>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value={to} />
      </>
    );
    return confirm ? (
      <ConfirmForm action={setSubscriptionStatus} message={confirm}>{inner}<Button variant="secondary" size="sm"><Icon className="h-3.5 w-3.5" /> {label}</Button></ConfirmForm>
    ) : (
      <form action={setSubscriptionStatus}>{inner}<SubmitButton variant="secondary" size="sm"><Icon className="h-3.5 w-3.5" /> {label}</SubmitButton></form>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/subscriptions" className="hover:text-brand-600">Subscriptions</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{s.name}<Badge className={st.color}>{st.label}</Badge></span>}
        description={s.customer ? <Link href={`/customers/${s.customer.id}`} className="hover:text-brand-600">{s.customer.company}</Link> : null}
        actions={
          canEdit && (
            <>
              {s.status === "active" && (
                <form action={billNow}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton variant="accent" size="sm" pendingText="Billing…"><ReceiptText className="h-3.5 w-3.5" /> Bill next period now</SubmitButton>
                </form>
              )}
              {s.status === "active" && <Action to="paused" label="Pause" icon={Pause} />}
              {s.status === "paused" && <Action to="active" label="Resume" icon={Play} />}
              {live && !s.cancel_at_period_end && s.cycles_billed > 0 && (
                <ConfirmForm action={cancelAtPeriodEnd} message={`End “${s.name}” on ${s.next_billing_date ? formatDate(s.next_billing_date) : "its next billing date"}? No further invoice will be raised.`}>
                  <input type="hidden" name="id" value={id} />
                  <Button variant="secondary" size="sm"><CalendarX className="h-3.5 w-3.5" /> Cancel at period end</Button>
                </ConfirmForm>
              )}
              {live && <Action to="cancelled" label="Cancel now" icon={Ban} confirm={`Cancel “${s.name}” now? No further invoices will be raised.`} />}
              {s.status !== "cancelled" && s.status !== "completed" && <LinkButton href={`/subscriptions/${id}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
              {can("sales", "full") && (
                <ConfirmForm action={deleteSubscription} message={`Delete “${s.name}”? Its invoices stay.`}>
                  <input type="hidden" name="id" value={id} />
                  <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete subscription"><Trash2 className="h-3.5 w-3.5" /></Button>
                </ConfirmForm>
              )}
            </>
          )
        }
      />
      {live && s.cancel_at_period_end && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2"><CalendarX className="h-4 w-4" /> Ends on <b>{s.next_billing_date ? formatDate(s.next_billing_date) : "its next billing date"}</b> — no further invoice will be raised.</span>
          {canEdit && (
            <form action={cancelAtPeriodEnd}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="undo" value="1" />
              <SubmitButton size="sm" variant="secondary" pendingText="…"><Undo2 className="h-3.5 w-3.5" /> Keep subscription</SubmitButton>
            </form>
          )}
        </div>
      )}
      {notStarted && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm text-sky-900">
          <CalendarClock className="h-4 w-4" /> Not started yet — the first invoice is raised on <b>{formatDate(s.next_billing_date)}</b>.
        </div>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Per invoice", formatMoney(withTax(s), s.currency), `incl. ${s.tax_rate}% GST`],
          ["Monthly value", formatMoney(monthly(s), s.currency), "before GST"],
          ["Billed so far", formatMoney(billed, s.currency), `${s.cycles_billed} invoice${s.cycles_billed === 1 ? "" : "s"}${s.ends_after_cycles ? ` of ${s.ends_after_cycles}` : ""}`],
          ["Collected", formatMoney(collected, s.currency), billed - collected > 0.5 ? `${formatMoney(billed - collected, s.currency)} outstanding` : "all paid"],
        ].map(([l, v, sub]) => (
          <Card key={l} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{v}</div>
            <div className="text-xs text-slate-400">{sub}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Invoices" />
          {!invoices?.length ? (
            <p className="px-5 py-6 text-sm text-slate-400">No invoices yet{s.next_billing_date ? ` — the first is raised on ${formatDate(s.next_billing_date)}` : ""}.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invoices.map((i) => {
                const ds = docStatus({ kind: "invoice", status: i.status, due_date: i.due_date, total: Number(i.total) }, bals.get(i.id));
                return (
                  <li key={i.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <Link href={docHref("invoice", i.id)} className="font-mono font-semibold text-brand-700">{docNumber("invoice", i.number)}</Link>
                    <span className="flex-1 text-slate-500">{formatDate(i.date)}</span>
                    <b>{formatMoney(Number(i.total), s.currency)}</b>
                    <Badge className={ds.color}>{ds.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="space-y-6 self-start">
        {canEdit && (
          <Card>
            <CardHeader title="E-mail" description={s.last_sent_at ? `Last sent ${formatDate(s.last_sent_at)}` : "Send the plan's details to the customer"} />
            <CardBody>
              <SendEmailForm action={sendSubscriptionEmail} hidden={{ subscription_id: id }} recipients={recipients} subject={tpl?.subject ?? `Your subscription: ${s.name}`} body={tpl?.body ?? ""} label="E-mail to customer" />
            </CardBody>
          </Card>
        )}
        <EmailHistory relType="subscription" relId={id} />
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              {[
                ["Billing", `Every ${INTERVAL_LABEL(s.interval_count, s.interval_unit)}`],
                ["Quantity × price", `${Number(s.quantity)} × ${formatMoney(Number(s.unit_price), s.currency)}`],
                ["Next invoice", s.status === "active" && s.next_billing_date ? formatDate(s.next_billing_date) : "—"],
                ["Started", formatDate(s.start_date)],
                ["Project", s.project?.name ?? "—"],
                ["Last e-mailed", s.last_sent_at ? formatDate(s.last_sent_at) : "Never"],
                ["Payment", s.auto_charge ? "Card on file, charged automatically (demo)" : "Customer pays each invoice"],
                ["Created by", s.creator?.full_name ?? "—"],
                ...(s.cancelled_at ? [["Cancelled", formatDate(s.cancelled_at)]] : []),
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd className="flex items-center gap-1.5 text-slate-700">{k === "Payment" && s.auto_charge && <CreditCard className="h-3.5 w-3.5 text-accent-600" />}{v}</dd>
                </div>
              ))}
            </dl>
            {s.description && <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">{s.description}</p>}
          </CardBody>
        </Card>
        </div>
      </div>
    </>
  );
}
