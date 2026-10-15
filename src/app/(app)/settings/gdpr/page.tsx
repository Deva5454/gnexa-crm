import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { anonymiseContact, resolveGdprRequest } from "../actions";

export const metadata: Metadata = { title: "Privacy (GDPR)" };

export default async function GdprPage() {
  const { supabase } = await requireAdmin();
  const [{ data: requests }, { count: contacts }, { count: consented }] = await Promise.all([
    supabase
      .from("gdpr_requests")
      .select("id, kind, note, status, created_at, resolved_at, customer:customers(id, company), contact:contacts(id, first_name, last_name, email), resolver:profiles!gdpr_requests_resolved_by_fkey(full_name)")
      .order("status")
      .order("created_at", { ascending: false }),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("marketing_consent", true),
  ]);
  const open = (requests ?? []).filter((r) => r.status === "open");
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open requests", String(open.length), open.length ? "text-amber-600" : "text-slate-900"],
          ["Marketing consent", `${consented ?? 0} of ${contacts ?? 0}`, "text-slate-900"],
          ["Requests handled", String((requests ?? []).length - open.length), "text-slate-900"],
        ].map(([l, v, t]) => (
          <Card key={l} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className={`mt-1 text-2xl font-bold ${t}`}>{v}</div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Data requests" description="Clients ask for a copy of their data or to be forgotten from the portal's Privacy page. Export a customer's data from here or from their page." />
        {!requests?.length ? (
          <p className="px-5 py-6 text-sm text-slate-400">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => {
              const who = r.contact ? [r.contact.first_name, r.contact.last_name].filter(Boolean).join(" ") : "Contact removed";
              return (
                <li key={r.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge className={r.kind === "erasure" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-sky-50 text-sky-700 ring-sky-200"}>{r.kind === "erasure" ? "Erasure" : "Data export"}</Badge>
                    <b className="text-slate-900">{who}</b>
                    {r.customer && <Link href={`/customers/${r.customer.id}?tab=contacts`} className="text-slate-500 hover:text-brand-700">· {r.customer.company}</Link>}
                    <span className="text-xs text-slate-400">· {formatDate(r.created_at)}</span>
                    <span className="ml-auto">
                      {r.status === "open" ? <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Open</Badge> : <Badge>{r.status === "completed" ? "Completed" : "Rejected"} {r.resolved_at ? formatDate(r.resolved_at) : ""}{r.resolver ? ` · ${r.resolver.full_name}` : ""}</Badge>}
                    </span>
                  </div>
                  {r.note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{r.note}”</p>}
                  {r.status === "open" && (
                    <div className="flex flex-wrap gap-2">
                      {r.customer && (
                        <a href={`/customers/${r.customer.id}/export`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Download className="h-3.5 w-3.5" /> Download customer data
                        </a>
                      )}
                      {r.kind === "erasure" && r.contact && (
                        <ConfirmForm action={anonymiseContact} message={`Anonymise ${who}? Their name, e-mail and phone are wiped and their portal login is removed. This can't be undone.`}>
                          <input type="hidden" name="contact_id" value={r.contact.id} />
                          <input type="hidden" name="request_id" value={r.id} />
                          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700"><UserX className="h-3.5 w-3.5" /> Anonymise contact</button>
                        </ConfirmForm>
                      )}
                      <form action={resolveGdprRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="completed" />
                        <SubmitButton size="sm" variant="secondary" pendingText="…"><ShieldCheck className="h-3.5 w-3.5" /> Mark completed</SubmitButton>
                      </form>
                      <form action={resolveGdprRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <SubmitButton size="sm" variant="ghost" pendingText="…">Reject</SubmitButton>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardBody className="text-sm text-slate-600">
          <b className="text-slate-800">How consent works:</b> each contact has a marketing-consent flag. Clients switch it themselves on the portal&apos;s Privacy page; staff see it on the customer&apos;s Contacts tab.
        </CardBody>
      </Card>
    </>
  );
}
