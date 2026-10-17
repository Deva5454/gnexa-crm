// Utilities → CSV export: every list the CRM keeps, as a spreadsheet-ready CSV.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { allRows } from "@/lib/fetch-all";
import type { Module } from "@/lib/permissions";
import { docNumber, type DocKind } from "@/lib/sales";
import { balancesFor } from "@/lib/sales-data";

type DB = SupabaseClient<Database>;
type Cell = string | number | boolean | null | undefined;
export type Dataset = {
  key: string;
  label: string;
  module: Module;
  /** filtered by this date column, when a range is given */
  dateLabel: string;
  load: (db: DB, from: string, to: string) => Promise<{ columns: string[]; rows: Cell[][] }>;
};

const day = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : "");
const toTs = (to: string) => `${to}T23:59:59.999+05:30`;

export const DATASETS: Dataset[] = [
  {
    key: "customers", label: "Customers", module: "customers", dateLabel: "Created",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("customers").select("id, company, vat, phone, website, address, city, state, zip, country, currency, is_active, created_at, group:customer_groups(name)").gte("created_at", from).lte("created_at", toTs(to)).order("id").range(a, b));
      return { columns: ["ID", "Company", "GSTIN / VAT", "Phone", "Website", "Address", "City", "State", "PIN", "Country", "Currency", "Group", "Active", "Created"], rows: data.map((c) => [c.id, c.company, c.vat, c.phone, c.website, c.address, c.city, c.state, c.zip, c.country, c.currency, c.group?.name, c.is_active ? "Yes" : "No", day(c.created_at)]) };
    },
  },
  {
    key: "contacts", label: "Contacts", module: "customers", dateLabel: "Created",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("contacts").select("id, first_name, last_name, email, phone, title, is_primary, created_at, customer:customers(company)").gte("created_at", from).lte("created_at", toTs(to)).order("id").range(a, b));
      return { columns: ["ID", "First name", "Last name", "E-mail", "Phone", "Title", "Customer", "Primary", "Created"], rows: data.map((c) => [c.id, c.first_name, c.last_name, c.email, c.phone, c.title, c.customer?.company, c.is_primary ? "Yes" : "No", day(c.created_at)]) };
    },
  },
  {
    key: "leads", label: "Leads", module: "leads", dateLabel: "Created",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("leads").select("id, name, company, email, phone, value, is_lost, is_junk, converted_customer_id, created_at, status:lead_statuses(name), source:lead_sources(name), owner:profiles!leads_assigned_to_fkey(full_name)").gte("created_at", from).lte("created_at", toTs(to)).order("id").range(a, b));
      return { columns: ["ID", "Name", "Company", "E-mail", "Phone", "Value", "Status", "Source", "Assigned to", "Lost", "Junk", "Converted", "Created"], rows: data.map((l) => [l.id, l.name, l.company, l.email, l.phone, l.value, l.status?.name, l.source?.name, l.owner?.full_name, l.is_lost ? "Yes" : "No", l.is_junk ? "Yes" : "No", l.converted_customer_id ? "Yes" : "No", day(l.created_at)]) };
    },
  },
  ...(["invoice", "estimate", "proposal", "credit_note"] as DocKind[]).map<Dataset>((kind) => ({
    key: `${kind}s`, label: { invoice: "Invoices", estimate: "Estimates", proposal: "Proposals", credit_note: "Credit notes" }[kind]!, module: "sales", dateLabel: "Date",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("sales_docs").select("id, number, date, due_date, status, currency, exchange_rate, subtotal, discount_total, tax_total, total, supply_type, place_of_supply, subject, customer:customers(company), lead:leads(name)").eq("kind", kind).gte("date", from).lte("date", to).order("date").order("id").range(a, b));
      const bals = await balancesFor(db, data.map((d) => d.id));
      return {
        columns: ["Number", "Date", "Due", "Customer / lead", "Subject", "Status", "Currency", "Rate", "Sub total", "Discount", "Tax", "Total", "Paid / used", "Balance", "Supply", "Place of supply"],
        rows: data.map((d) => {
          const b = bals.get(d.id);
          return [docNumber(kind, d.number), d.date, d.due_date, d.customer?.company ?? d.lead?.name, d.subject, d.status, d.currency, d.exchange_rate, d.subtotal, d.discount_total, d.tax_total, d.total, (b?.paid ?? 0) + (b?.credited ?? 0) + (b?.credit_used ?? 0), b?.balance ?? d.total, d.supply_type, d.place_of_supply];
        }),
      };
    },
  })),
  {
    key: "payments", label: "Payments", module: "sales", dateLabel: "Date",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("payments").select("id, date, amount, transaction_id, note, mode:payment_modes(name), invoice:sales_docs(number, currency, customer:customers(company))").gte("date", from).lte("date", to).order("date").order("id").range(a, b));
      return { columns: ["ID", "Date", "Invoice", "Customer", "Amount", "Currency", "Mode", "Transaction ID", "Note"], rows: data.map((p) => [p.id, p.date, p.invoice ? docNumber("invoice", p.invoice.number) : "", p.invoice?.customer?.company, p.amount, p.invoice?.currency, p.mode?.name, p.transaction_id, p.note]) };
    },
  },
  {
    key: "expenses", label: "Expenses", module: "expenses", dateLabel: "Date",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("expenses").select("id, date, name, amount, tax_rate, reference, is_billable, category:expense_categories(name), customer:customers(company), project:projects(name), mode:payment_modes(name), invoice:sales_docs(number)").gte("date", from).lte("date", to).order("date").order("id").range(a, b));
      return { columns: ["ID", "Date", "Name", "Category", "Amount", "GST %", "Total", "Customer", "Project", "Paid via", "Billable", "Invoice", "Reference"], rows: data.map((e) => [e.id, e.date, e.name, e.category?.name, e.amount, e.tax_rate, Math.round(Number(e.amount) * (1 + Number(e.tax_rate) / 100) * 100) / 100, e.customer?.company, e.project?.name, e.mode?.name, e.is_billable ? "Yes" : "No", e.invoice ? docNumber("invoice", e.invoice.number) : "", e.reference]) };
    },
  },
  {
    key: "tasks", label: "Tasks", module: "tasks", dateLabel: "Created",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("tasks").select("id, name, status, priority, start_date, due_date, rel_type, rel_id, created_at").gte("created_at", from).lte("created_at", toTs(to)).order("id").range(a, b));
      return { columns: ["ID", "Name", "Status", "Priority", "Start", "Due", "Related to", "Related ID", "Created"], rows: data.map((t) => [t.id, t.name, t.status, t.priority, t.start_date, t.due_date, t.rel_type, t.rel_id, day(t.created_at)]) };
    },
  },
  {
    key: "projects", label: "Projects", module: "projects", dateLabel: "Start",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("projects").select("id, name, status, billing_type, fixed_price, hourly_rate, start_date, deadline, customer:customers(company)").gte("start_date", from).lte("start_date", to).order("id").range(a, b));
      return { columns: ["ID", "Name", "Customer", "Status", "Billing", "Fixed price", "Hourly rate", "Start", "Deadline"], rows: data.map((p) => [p.id, p.name, p.customer?.company, p.status, p.billing_type, p.fixed_price, p.hourly_rate, p.start_date, p.deadline]) };
    },
  },
  {
    key: "timesheets", label: "Timesheets", module: "projects", dateLabel: "Date",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("timesheets").select("id, date, hours, is_billable, invoice_id, note, project:projects(name), task:tasks(name), staff:profiles(full_name)").gte("date", from).lte("date", to).order("date").order("id").range(a, b));
      return { columns: ["ID", "Date", "Staff", "Project", "Task", "Hours", "Billable", "Invoiced", "Note"], rows: data.map((t) => [t.id, t.date, t.staff?.full_name, t.project?.name, t.task?.name, t.hours, t.is_billable ? "Yes" : "No", t.invoice_id ? "Yes" : "No", t.note]) };
    },
  },
  {
    key: "contracts", label: "Contracts", module: "contracts", dateLabel: "Start",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("contracts").select("id, subject, value, start_date, end_date, status, signed_by, signed_at, customer:customers(company), type:contract_types(name), project:projects(name)").gte("start_date", from).lte("start_date", to).order("start_date").order("id").range(a, b));
      return { columns: ["ID", "Subject", "Customer", "Type", "Project", "Value", "Start", "End", "Status", "Signed by", "Signed on"], rows: data.map((c) => [c.id, c.subject, c.customer?.company, c.type?.name, c.project?.name, c.value, c.start_date, c.end_date, c.status, c.signed_by, day(c.signed_at)]) };
    },
  },
  {
    key: "tickets", label: "Support tickets", module: "support", dateLabel: "Opened",
    load: async (db, from, to) => {
      const { data } = await allRows((a, b) => db.from("tickets").select("id, subject, status, priority, created_at, closed_at, customer:customers(company), department:ticket_departments(name), service:ticket_services(name), assignee:profiles!tickets_assigned_to_fkey(full_name)").gte("created_at", from).lte("created_at", toTs(to)).order("id").range(a, b));
      return { columns: ["ID", "Subject", "Customer", "Department", "Service", "Assigned to", "Priority", "Status", "Opened", "Closed"], rows: data.map((t) => [t.id, t.subject, t.customer?.company, t.department?.name, t.service?.name, t.assignee?.full_name, t.priority, t.status, day(t.created_at), day(t.closed_at)]) };
    },
  },
];

/** RFC 4180 CSV with a BOM so Excel opens Indian-rupee text and names correctly. */
export function csvText(columns: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [columns, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
