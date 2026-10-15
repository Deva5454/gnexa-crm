import { Bot, Mail } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
import { cn, formatDateTime } from "@/lib/utils";

export const EMAIL_KIND: Record<string, { label: string; color: string }> = {
  document: { label: "Document", color: "bg-brand-50 text-brand-700" },
  overdue_reminder: { label: "Overdue reminder", color: "bg-rose-50 text-rose-700" },
  statement: { label: "Statement", color: "bg-sky-50 text-sky-700" },
  receipt: { label: "Receipt", color: "bg-emerald-50 text-emerald-700" },
  subscription: { label: "Subscription", color: "bg-violet-50 text-violet-700" },
  manual: { label: "E-mail", color: "bg-slate-100 text-slate-600" },
};

/** E-mails logged for one document, or for one customer. */
export async function EmailHistory({ relType, relId, customerId, limit = 8 }: { relType?: string; relId?: number; customerId?: number; limit?: number }) {
  const { supabase } = await requireStaff();
  let q = supabase
    .from("email_log")
    .select("id, to_email, to_name, subject, body, kind, automatic, created_at, sender:profiles!email_log_sent_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (customerId) q = q.eq("customer_id", customerId);
  else q = q.eq("rel_type", relType!).eq("rel_id", relId!);
  const { data: rows } = await q;
  return (
    <Card>
      <CardHeader title="E-mails" description="Demo mode: logged, never delivered" />
      {!rows?.length ? (
        <p className="px-5 py-4 text-sm text-slate-400">Nothing sent yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((e) => {
            const k = EMAIL_KIND[e.kind] ?? EMAIL_KIND.manual!;
            return (
              <li key={e.id}>
                <details className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none items-start gap-2.5">
                    {e.automatic ? <Bot className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> : <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{e.subject}</span>
                      <span className="block text-xs text-slate-500" suppressHydrationWarning>
                        To {e.to_name ?? e.to_email ?? "—"} · {e.automatic ? "automatic" : e.sender?.full_name ?? "staff"} · {formatDateTime(e.created_at)}
                      </span>
                    </span>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", k.color)}>{k.label}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">{e.body}</p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
