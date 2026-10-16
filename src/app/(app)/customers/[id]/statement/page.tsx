import type { Metadata } from "next";
import { renderTemplate } from "@/lib/email-templates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { SendEmailForm } from "@/components/crm/send-email-form";
import { loadParty } from "@/components/sales/party";
import { StatementPaper } from "@/components/sales/statement-paper";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { sendStatementEmail } from "@/lib/actions/email";
import { requireStaff } from "@/lib/auth";
import { companySettings } from "@/lib/sales-data";
import { buildStatement, defaultRange } from "@/lib/statement";
import { formatDate, formatMoney } from "@/lib/utils";
import { daysFromToday } from "@/lib/dates";

export const metadata: Metadata = { title: "Statement" };

const iso = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export default async function StatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("sales", "view")) notFound();
  const def = defaultRange();
  const from = iso(sp.from) ?? def.from;
  const to = iso(sp.to) ?? def.to;
  const [{ data: c }, company, s, { data: contacts }] = await Promise.all([
    supabase.from("customers").select("id, company").eq("id", id).maybeSingle(),
    companySettings(supabase),
    buildStatement(supabase, id, from, to),
    supabase.from("contacts").select("email, first_name, last_name").eq("customer_id", id).not("email", "is", null).order("is_primary", { ascending: false }),
  ]);
  if (!c) notFound();
  const party = await loadParty(supabase, { customer_id: id, lead_id: null });
  const recipients = (contacts ?? []).map((x) => ({ email: x.email!, name: [x.first_name, x.last_name].filter(Boolean).join(" ") || null }));
  const tpl = await renderTemplate(supabase, "statement", {
    contact_name: (recipients[0]?.name ?? "").split(" ")[0] || "there",
    customer: c.company,
    company_name: company?.company_name ?? "",
    from: formatDate(from),
    to: formatDate(to),
    balance: formatMoney(s.closing, s.currency),
  });
  const qs = `from=${from}&to=${to}`;
  const presets = [
    ["This financial year", def.from, def.to],
    ["Last 90 days", daysFromToday(-90), def.to],
    ["All time", "2000-01-01", def.to],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/customers/${id}?tab=billing`} className="hover:text-brand-600">{c.company}</Link>}
        title="Account statement"
        description={`${formatDate(from)} – ${formatDate(to)} · balance due ${formatMoney(s.closing, s.currency)}`}
        actions={
          <a href={`/print/statement/${id}?${qs}`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
            <Printer className="h-3.5 w-3.5" /> PDF / Print
          </a>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <StatementPaper s={s} company={company} party={party} />
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Period" />
            <CardBody className="space-y-3">
              <form className="grid grid-cols-2 gap-2">
                <input type="date" name="from" defaultValue={from} className="field" aria-label="From" />
                <input type="date" name="to" defaultValue={to} className="field" aria-label="To" />
                <button className="col-span-2 h-9 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">Update</button>
              </form>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(([l, f, t]) => (
                  <Link key={l} href={`/customers/${id}/statement?from=${f}&to=${t}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700">{l}</Link>
                ))}
              </div>
            </CardBody>
          </Card>
          {can("sales", "edit") && (
            <Card>
              <CardHeader title="Send to customer" />
              <CardBody>
                <SendEmailForm
                  action={sendStatementEmail}
                  hidden={{ customer_id: id }}
                  recipients={recipients}
                  subject={tpl?.subject ?? `Account statement ${formatDate(from)} – ${formatDate(to)}`}
                  body={tpl?.body ?? ""}
                  attachment={`Statement ${c.company}.pdf`}
                  label="E-mail statement"
                  tone="primary"
                />
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
