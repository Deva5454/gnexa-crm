import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/** Everything held about one customer, as JSON — used for staff exports and the client's own "download my data". */
export async function customerDataExport(supabase: SupabaseClient<Database>, customerId: number) {
  const [customer, contacts, docs, payments, tickets, contracts, projects, subscriptions] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
    supabase.from("contacts").select("*").eq("customer_id", customerId),
    supabase.from("sales_docs").select("id, kind, number, date, due_date, status, currency, total, subject, sales_doc_items(description, qty, rate, tax_rate)").eq("customer_id", customerId).neq("status", "draft"),
    supabase.from("payments").select("invoice_id, amount, date, transaction_id, invoice:sales_docs!inner(customer_id)").eq("invoice.customer_id", customerId),
    supabase.from("tickets").select("id, subject, status, created_at, ticket_replies(body, created_at, author_name, is_internal)").eq("customer_id", customerId),
    supabase.from("contracts").select("id, subject, status, start_date, end_date, value, signed_by, signed_at").eq("customer_id", customerId).neq("status", "draft"),
    supabase.from("projects").select("id, name, status, start_date, deadline").eq("customer_id", customerId),
    supabase.from("subscriptions").select("name, status, unit_price, quantity, interval_count, interval_unit, start_date").eq("customer_id", customerId),
  ]);
  return {
    exported_at: new Date().toISOString(),
    customer: customer.data,
    contacts: contacts.data ?? [],
    documents: docs.data ?? [],
    payments: (payments.data ?? []).map((p) => ({ invoice_id: p.invoice_id, amount: p.amount, date: p.date, transaction_id: p.transaction_id })),
    tickets: (tickets.data ?? []).map((t) => ({ ...t, ticket_replies: t.ticket_replies.filter((r) => !r.is_internal) })),
    contracts: contracts.data ?? [],
    projects: projects.data ?? [],
    subscriptions: subscriptions.data ?? [],
  };
}

export function jsonDownload(data: unknown, filename: string) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` },
  });
}
