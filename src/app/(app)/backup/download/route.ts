import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";
import { todayIST } from "@/lib/dates";

type Table = keyof Database["public"]["Tables"];

// Everything the CRM stores, table by table (files in storage are not included)
const TABLES: Table[] = [
  "company_settings", "roles", "profiles", "currencies", "taxes", "payment_modes", "expense_categories", "customer_groups",
  "lead_statuses", "lead_sources", "contract_types", "ticket_departments", "kb_groups", "custom_fields", "email_templates",
  "web_forms", "estimate_request_statuses", "tags",
  "customers", "customer_admins", "customer_files", "contacts", "leads", "lead_files", "notes", "taggables", "custom_field_values",
  "items", "sales_docs", "sales_doc_items", "payments", "credit_applications", "subscriptions", "expenses",
  "projects", "project_members", "milestones", "timesheets", "tasks", "task_assignees", "task_checklist_items", "task_comments",
  "contracts", "tickets", "ticket_replies", "kb_articles", "estimate_requests",
  "goals", "calendar_events", "announcements", "posts", "post_comments", "surveys", "survey_questions", "survey_responses", "survey_answers",
  "gdpr_requests", "email_log", "activity_log",
];

export async function GET() {
  const { supabase } = await requireAdmin();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    try {
      // loose typing on purpose: one generic loop over every table
      const from = supabase.from(t as "customers") as unknown as { select: (c: string) => { range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } };
      tables[t] = (await allRows((a, b) => from.select("*").range(a, b), 200_000)).data;
    } catch {
      tables[t] = [];
    }
  }
  await logActivity(supabase, "downloaded a database backup");
  const body = JSON.stringify({ app: "Gnexa CRM", exported_at: new Date().toISOString(), tables }, null, 1);
  return new NextResponse(body, {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="gnexa-backup-${todayIST()}.json"` },
  });
}
