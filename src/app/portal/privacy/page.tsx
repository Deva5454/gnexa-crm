import type { Metadata } from "next";
import { Download, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { ConsentForm, ErasureForm } from "./forms";

export const metadata: Metadata = { title: "Privacy" };

export default async function PortalPrivacy() {
  const { supabase, user, company } = await requirePortal();
  const [{ data: pu }, { data: requests }] = await Promise.all([
    supabase.from("portal_users").select("contact:contacts(marketing_consent, consent_updated_at)").eq("user_id", user.id).maybeSingle(),
    supabase.from("gdpr_requests").select("id, kind, status, created_at, resolved_at").order("created_at", { ascending: false }),
  ]);
  const consent = pu?.contact?.marketing_consent ?? false;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Privacy</h1>
      <p className="mb-6 text-sm text-slate-500">Control how {company} uses your personal data.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Marketing e-mails" description={pu?.contact?.consent_updated_at ? `Last updated ${formatDate(pu.contact.consent_updated_at)}` : undefined} />
          <CardBody><ConsentForm consent={consent} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Download your data" description="A copy of your account: contacts, documents, payments, tickets, contracts and projects (JSON)." />
          <CardBody>
            <a href="/portal/privacy/export" className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              <Download className="h-4 w-4" /> Download my data
            </a>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Delete my personal details" description="We'll remove your name and contact details. Invoices stay on record as the law requires." />
          <CardBody><ErasureForm /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Your requests" />
          {!requests?.length ? (
            <p className="px-5 py-4 text-sm text-slate-400">No requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  <span className="flex-1">{r.kind === "erasure" ? "Deletion" : "Data export"} · {formatDate(r.created_at)}</span>
                  <Badge className={r.status === "open" ? "bg-amber-50 text-amber-700 ring-amber-200" : r.status === "completed" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}>
                    {r.status === "open" ? "In progress" : r.status === "completed" ? "Done" : "Declined"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
