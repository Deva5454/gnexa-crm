import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/layout/logo";
import { DocPaper, type Party } from "@/components/sales/doc-paper";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { Tables } from "@/lib/database.types";
import { docNumber, docStatus, KINDS, type DocKind } from "@/lib/sales";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { CommentForm, PrintButton, RespondForm } from "../public-forms";

type PublicDoc = {
  doc: Tables<"sales_docs"> & { kind: DocKind; expired: boolean };
  lines: Tables<"sales_doc_items">[];
  party: Party;
  company: Tables<"company_settings">;
  comments: { body: string; from_customer: boolean; author: string; created_at: string }[];
};

// One read per request (metadata and page share it), so a visit is counted once
const load = cache(async (token: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_doc", { p_token: token });
  return (data as PublicDoc | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const d = await load((await params).token);
  const title = d ? `${docNumber(d.doc.kind, d.doc.number)}${d.doc.subject ? ` · ${d.doc.subject}` : ""} · ${d.company?.company_name ?? ""}` : "Proposal";
  return { title: { absolute: title }, robots: { index: false, follow: false } };
}

/** Perfex-style public proposal / estimate: read, comment, accept with a typed name, or decline — no sign-in. */
export default async function PublicDocPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const d = await load(token);
  if (!d) notFound();
  const { doc } = d;
  const kind = doc.kind;
  const label = KINDS[kind].label;
  const status = docStatus({ kind, status: doc.status, due_date: doc.due_date, total: Number(doc.total) }, undefined);
  const canRespond = doc.status === "sent" && !doc.expired;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="font-bold text-slate-900">{d.company?.company_name}</span>
        </div>
        <PrintButton />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] print:block">
        <DocPaper kind={kind} doc={doc} lines={d.lines} company={d.company} party={d.party} status={status} />
        <aside className="space-y-6 print:hidden">
          {doc.responded_by && (doc.status === "accepted" || doc.status === "declined") && (
            <Card>
              <CardBody className="text-sm">
                <div className={doc.status === "accepted" ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>
                  {doc.status === "accepted" ? "Accepted" : "Declined"} by {doc.responded_by}
                </div>
                {doc.responded_at && <div className="text-xs text-slate-500">{formatDate(doc.responded_at)}</div>}
              </CardBody>
            </Card>
          )}
          {canRespond && (
            <Card>
              <CardHeader title={`Respond to this ${label.toLowerCase()}`} description={doc.due_date ? `Valid until ${formatDate(doc.due_date)}` : undefined} />
              <CardBody><RespondForm token={token} kindLabel={label} /></CardBody>
            </Card>
          )}
          {doc.status === "sent" && doc.expired && (
            <Card><CardBody className="text-sm text-amber-800">This {label.toLowerCase()} expired on {formatDate(doc.due_date)}. Please contact us for an updated one.</CardBody></Card>
          )}
          {(doc.allow_comments || d.comments.length > 0) && (
            <Card>
              <CardHeader title="Discussion" description={doc.allow_comments ? "Questions or changes? Write to us here." : "Comments are closed."} />
              <CardBody className="space-y-4">
                {d.comments.length > 0 && (
                  <ul className="space-y-3">
                    {d.comments.map((c, i) => (
                      <li key={i} className={cn("rounded-xl px-3 py-2 text-sm", c.from_customer ? "bg-slate-50" : "bg-brand-50")}>
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-800">{c.author}{!c.from_customer && <span className="ml-1 font-normal text-brand-700">· {d.company?.company_name}</span>}</span>
                          <span className="shrink-0 text-slate-400" suppressHydrationWarning>{formatDateTime(c.created_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {doc.allow_comments && <CommentForm token={token} />}
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
      <p className="mt-6 text-center text-xs text-slate-400 print:hidden">Powered by Gnexa CRM</p>
    </div>
  );
}
