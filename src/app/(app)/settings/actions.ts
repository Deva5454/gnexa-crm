"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { num, str } from "@/lib/utils";
import { friendlyError, must, withFlash } from "@/lib/flash";
import { THEMES } from "@/lib/theme";
import type { Json } from "@/lib/database.types";
import { MODULES } from "@/lib/permissions";
import { DATE_FORMATS } from "@/lib/format-config";
import { FEATURES, readMenuConfig } from "@/components/layout/nav";

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function updateCompany(_: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase } = await requireAdmin();
  const company_name = str(form, "company_name");
  const currency = str(form, "currency")?.toUpperCase();
  if (!company_name || !currency || currency.length !== 3) return { error: "Company name and a 3-letter currency code are required." };
  const { error } = await supabase
    .from("company_settings")
    .update({
      company_name,
      currency,
      address: str(form, "address"),
      gstin: str(form, "gstin")?.toUpperCase() ?? null,
      email: str(form, "email"),
      phone: str(form, "phone"),
      bank_details: str(form, "bank_details"),
      default_terms: str(form, "default_terms"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

export async function updateStaff(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireAdmin();
    const id = str(form, "id")!;
    const patch = {
      role_id: num(form, "role_id"),
      // An admin can't lock themselves out
      is_admin: id === profile.id ? true : form.get("is_admin") === "on",
      is_active: id === profile.id ? true : form.get("is_active") === "on",
    };
    must(await supabase.from("profiles").update(patch).eq("id", id));
    // Support departments the person belongs to (they get portal tickets for these)
    const depts = form.getAll("dept").map(Number).filter(Boolean);
    must(await supabase.from("staff_departments").delete().eq("staff_id", id));
    if (depts.length) must(await supabase.from("staff_departments").insert(depts.map((department_id) => ({ staff_id: id, department_id }))));
    revalidatePath("/settings/staff");
  });
}

/** Staff member page: profile details as well as role, access and departments. */
export async function saveStaffMember(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireAdmin();
    const id = str(form, "id")!;
    const name = (str(form, "full_name") ?? "").slice(0, 120);
    if (!name) throw new Error("Enter the person's name.");
    must(
      await supabase
        .from("profiles")
        .update({
          full_name: name,
          job_title: (str(form, "job_title") ?? "").slice(0, 120) || null,
          phone: (str(form, "phone") ?? "").slice(0, 40) || null,
          role_id: num(form, "role_id"),
          // An admin can't lock themselves out
          is_admin: id === profile.id ? true : form.get("is_admin") === "on",
          is_active: id === profile.id ? true : form.get("is_active") === "on",
        })
        .eq("id", id),
    );
    const depts = form.getAll("dept").map(Number).filter(Boolean);
    must(await supabase.from("staff_departments").delete().eq("staff_id", id));
    if (depts.length) must(await supabase.from("staff_departments").insert(depts.map((department_id) => ({ staff_id: id, department_id }))));
    revalidatePath("/settings/staff");
    revalidatePath(`/settings/staff/${id}`);
  });
}

/** Let a pending sign-up in, straight from the staff list. */
export async function approveStaff(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("profiles").update({ is_active: true }).eq("id", str(form, "id")!));
    revalidatePath("/settings/staff");
  });
}

export async function addStaffNote(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const staffId = str(form, "staff_id")!;
    const body = (str(form, "body") ?? "").slice(0, 5000);
    if (!body) throw new Error("Write the note first.");
    must(await supabase.from("staff_notes").insert({ staff_id: staffId, body }));
    revalidatePath(`/settings/staff/${staffId}`);
  });
}

export async function deleteStaffNote(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const { data } = must(await supabase.from("staff_notes").delete().eq("id", Number(str(form, "id"))).select("staff_id").maybeSingle());
    if (data) revalidatePath(`/settings/staff/${data.staff_id}`);
  });
}

export async function savePredefinedReply(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const title = str(form, "title");
    const body = str(form, "body");
    if (!title || !body) return;
    if (id) must(await supabase.from("predefined_replies").update({ title, body }).eq("id", id));
    else await supabase.from("predefined_replies").insert({ title, body });
    revalidatePath("/settings/support");
  });
}

export async function deletePredefinedReply(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("predefined_replies").delete().eq("id", Number(str(form, "id"))));
    revalidatePath("/settings/support");
  });
}

export async function addStatus(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const name = str(form, "name");
    if (!name) return;
    const { data: last } = await supabase.from("lead_statuses").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    must(await supabase.from("lead_statuses").insert({ name, color: str(form, "color") ?? "#6366f1", sort_order: (last?.sort_order ?? 0) + 1, is_won: form.get("is_won") === "on" }));
    revalidatePath("/settings/leads");
  });
}

export async function updateStatus(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const name = str(form, "name");
    if (!name) return;
    await supabase
      .from("lead_statuses")
      .update({ name, color: str(form, "color") ?? "#6366f1", sort_order: num(form, "sort_order") ?? 0, is_won: form.get("is_won") === "on" })
      .eq("id", id);
    revalidatePath("/settings/leads");
    revalidatePath("/leads");
  });
}

const SIMPLE = ["lead_sources", "customer_groups", "roles", "lead_statuses", "payment_modes", "expense_categories", "taxes", "contract_types", "ticket_departments", "ticket_services", "kb_groups"] as const;
type SimpleTable = (typeof SIMPLE)[number];

export async function addNamed(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const table = str(form, "table") as SimpleTable;
    const name = str(form, "name");
    if (!SIMPLE.includes(table) || table === "lead_statuses" || table === "taxes" || !name) return;
    must(await supabase.from(table).insert({ name }));
    revalidatePath("/settings", "layout");
  });
}

export async function deleteNamed(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const table = str(form, "table") as SimpleTable;
    const id = Number(str(form, "id"));
    if (!SIMPLE.includes(table)) return;
    must(await supabase.from(table).delete().eq("id", id));
    revalidatePath("/settings", "layout");
  });
}

/** Setup → Finance → Payment modes: Perfex's options for one mode. */
export async function savePaymentMode(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const name = (str(form, "name") ?? "").slice(0, 80);
    if (!name) throw new Error("Give the payment mode a name.");
    const applies = str(form, "applies_to") ?? "all";
    const isDefault = form.get("is_default") === "on";
    const isActive = form.get("is_active") === "on";
    if (isDefault && !isActive) throw new Error("An inactive mode can't be the default.");
    // Only one default: clear the old one first
    if (isDefault) must(await supabase.from("payment_modes").update({ is_default: false }).eq("is_default", true).neq("id", id));
    must(
      await supabase
        .from("payment_modes")
        .update({
          name,
          description: (str(form, "description") ?? "").slice(0, 1000) || null,
          is_active: isActive,
          show_on_invoice: form.get("show_on_invoice") === "on",
          is_default: isDefault,
          applies_to: ["all", "invoices", "expenses"].includes(applies) ? applies : "all",
        })
        .eq("id", id),
    );
    revalidatePath("/settings", "layout");
  });
}

/** Setup → Settings → Numbering & dates: document number prefixes, number width and date format. */
export async function saveNumbering(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const prefix = (k: string, label: string) => {
      const v = (str(form, k) ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9/]{1,10}$/.test(v)) throw new Error(`The ${label} prefix can only use letters, digits and “/” (up to 10).`);
      return v;
    };
    const padding = Math.round(Number(str(form, "number_padding")));
    const dateFormat = str(form, "date_format") ?? "dd MMM yyyy";
    if (!DATE_FORMATS.some((f) => f.value === dateFormat)) throw new Error("Pick a date format from the list.");
    must(
      await supabase
        .from("company_settings")
        .update({
          invoice_prefix: prefix("invoice_prefix", "invoice"),
          estimate_prefix: prefix("estimate_prefix", "estimate"),
          proposal_prefix: prefix("proposal_prefix", "proposal"),
          credit_note_prefix: prefix("credit_note_prefix", "credit note"),
          number_padding: Number.isInteger(padding) && padding >= 1 && padding <= 10 ? padding : 5,
          date_format: dateFormat,
        })
        .eq("id", true),
    );
    // Every screen prints numbers and dates
    revalidatePath("/", "layout");
  });
}

/** Setup → Settings → New records: defaults for new invoices, quotes and customers. */
export async function saveRecordDefaults(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const days = (k: string, min: number, fallback: number) => {
      const n = Math.round(Number(str(form, k)));
      return Number.isFinite(n) && n >= min && n <= 365 ? n : fallback;
    };
    const text = (k: string, max: number) => (str(form, k) ?? "").slice(0, max) || null;
    must(
      await supabase
        .from("company_settings")
        .update({
          invoice_due_days: days("invoice_due_days", 0, 15),
          quote_valid_days: days("quote_valid_days", 1, 30),
          invoice_note: text("invoice_note", 1000),
          estimate_terms: text("estimate_terms", 2000),
          proposal_terms: text("proposal_terms", 2000),
          default_country: text("default_country", 80),
        })
        .eq("id", true),
    );
    revalidatePath("/settings");
  });
}

export async function resetDemoData(): Promise<SettingsState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("reset_demo_data");
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Demo data restored — customers, leads, tasks and notes are back to their starting state." };
}

export async function addTax(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const rate = num(form, "rate");
    if (rate == null || rate < 0 || rate > 100) return;
    must(await supabase.from("taxes").insert({ name: str(form, "name") ?? `GST ${rate}%`, rate }));
    revalidatePath("/settings/finance");
  });
}

export async function saveRolePermissions(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "role_id"));
    const { MODULES } = await import("@/lib/permissions");
    const permissions: Record<string, string> = {};
    for (const m of MODULES) {
      const v = str(form, m);
      permissions[m] = v === "none" || v === "view" || v === "edit" || v === "full" ? v : "view";
    }
    must(await supabase.from("roles").update({ permissions }).eq("id", id));
    revalidatePath("/settings/staff");
  });
}

export async function saveReminderSettings(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const days = Math.min(60, Math.max(1, Math.round(num(form, "days") ?? 7)));
    must(await supabase.from("company_settings").update({ auto_overdue_reminders: form.get("auto") === "on", overdue_reminder_days: days }).eq("id", true));
    revalidatePath("/settings/finance");
  });
}

export async function saveExpirySettings(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const days = Math.min(30, Math.max(1, Math.round(num(form, "days") ?? 3)));
    must(await supabase.from("company_settings").update({ auto_expiry_reminders: form.get("auto") === "on", expiry_reminder_days: days }).eq("id", true));
    revalidatePath("/settings/finance");
  });
}

export async function saveTicketAutoclose(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const hours = form.get("auto") === "on" ? Math.min(8760, Math.max(1, Math.round(num(form, "hours") ?? 72))) : null;
    must(await supabase.from("company_settings").update({ ticket_autoclose_hours: hours }).eq("id", true));
    revalidatePath("/settings/support");
  });
}

export async function saveEmailTemplate(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const key = str(form, "key");
    const subject = str(form, "subject");
    const body = str(form, "body");
    if (!key || !subject || !body) return;
    must(await supabase.from("email_templates").update({ subject: subject.slice(0, 200), body: body.slice(0, 8000), updated_at: new Date().toISOString() }).eq("key", key));
    revalidatePath("/settings/email-templates");
  });
}

export async function saveCurrency(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const id = Number(str(form, "id"));
    const name = str(form, "name");
    const symbol = str(form, "symbol");
    const rate = num(form, "rate");
    if (!name || !symbol) return;
    if (id) {
      const { data: cur } = await supabase.from("currencies").select("is_base").eq("id", id).single();
      if (form.get("make_base") === "on" && !cur?.is_base) {
        // New base: rescale every rate so the new base is 1
        const { data: all } = await supabase.from("currencies").select("id, rate");
        const r = Number(all?.find((c) => c.id === id)?.rate ?? 1);
        must(await supabase.from("currencies").update({ is_base: false }).eq("is_base", true));
        for (const c of all ?? []) await supabase.from("currencies").update({ rate: Math.round((Number(c.rate) / r) * 1e6) / 1e6 }).eq("id", c.id);
        must(await supabase.from("currencies").update({ is_base: true, rate: 1, name, symbol }).eq("id", id));
        const { data: code } = await supabase.from("currencies").select("code").eq("id", id).single();
        if (code) must(await supabase.from("company_settings").update({ currency: code.code }).eq("id", true));
      } else {
        must(await supabase.from("currencies").update({ name, symbol, ...(cur?.is_base ? {} : rate && rate > 0 ? { rate } : {}) }).eq("id", id));
      }
    } else {
      const code = (str(form, "code") ?? "").toUpperCase();
      if (!/^[A-Z]{3}$/.test(code) || !rate || rate <= 0) return;
      must(await supabase.from("currencies").insert({ code, name, symbol, rate }));
    }
    revalidatePath("/settings/currencies");
  });
}

export async function deleteCurrency(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("currencies").delete().eq("id", Number(str(form, "id"))).eq("is_base", false));
    revalidatePath("/settings/currencies");
  });
}

export async function resolveGdprRequest(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireAdmin();
    const status = str(form, "status") === "rejected" ? "rejected" : "completed";
    must(await supabase.from("gdpr_requests").update({ status, resolved_at: new Date().toISOString(), resolved_by: profile.id }).eq("id", Number(str(form, "id"))));
    revalidatePath("/settings/gdpr");
  });
}

/** Right to be forgotten: wipe a contact's personal details and remove their portal login link. */
export async function anonymiseContact(form: FormData) {
  return withFlash(async () => {
    const { supabase, profile } = await requireAdmin();
    const contactId = Number(str(form, "contact_id"));
    const { data: c } = await supabase.from("contacts").select("customer_id").eq("id", contactId).single();
    if (!c) return;
    await supabase
      .from("contacts")
      .update({ first_name: "Anonymised", last_name: `contact #${contactId}`, email: null, phone: null, title: null, marketing_consent: false, consent_updated_at: new Date().toISOString() })
      .eq("id", contactId);
    must(await supabase.from("portal_users").delete().eq("contact_id", contactId));
    const reqId = Number(str(form, "request_id"));
    if (reqId) must(await supabase.from("gdpr_requests").update({ status: "completed", resolved_at: new Date().toISOString(), resolved_by: profile.id }).eq("id", reqId));
    must(await supabase.from("activity_log").insert({ description: `anonymised a contact (GDPR erasure request)`, rel_type: "customer", rel_id: c.customer_id }));
    revalidatePath("/settings/gdpr");
    revalidatePath(`/customers/${c.customer_id}`);
  });
}

// ───────────── Setup → Modules / Menu setup / Theme style / Estimate request statuses ─────────────
export async function saveModules(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const all = [...MODULES, ...FEATURES] as string[];
    const off = all.filter((m) => form.get(`on_${m}`) !== "on");
    must(await supabase.from("company_settings").update({ disabled_modules: off }).eq("id", true));
    revalidatePath("/", "layout");
  });
}

export async function saveMenu(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(form.get("menu") ?? "{}"));
    } catch {
      throw new Error("The menu layout could not be read.");
    }
    const cfg = readMenuConfig(parsed);
    // never let the Setup link disappear, or there'd be no way back
    cfg.hidden = (cfg.hidden ?? []).filter((h) => h !== "/settings");
    must(await supabase.from("company_settings").update({ menu_config: cfg as Json }).eq("id", true));
    revalidatePath("/", "layout");
  });
}

export async function resetMenu() {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("company_settings").update({ menu_config: {} }).eq("id", true));
    revalidatePath("/", "layout");
  });
}

export async function saveTheme(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const theme = str(form, "theme") ?? "violet";
    if (!(theme in THEMES)) throw new Error("Pick one of the colour presets.");
    must(await supabase.from("company_settings").update({ theme }).eq("id", true));
    revalidatePath("/", "layout");
  });
}

export async function saveReqStatus(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const name = (str(form, "name") ?? "").slice(0, 40);
    if (!name) throw new Error("Give the status a name.");
    const color = /^#[0-9a-fA-F]{6}$/.test(str(form, "color") ?? "") ? str(form, "color")! : "#64748b";
    const fields = { name, color, is_open: form.get("is_open") === "on", sort_order: Math.round(num(form, "sort_order") ?? 0) };
    const key = str(form, "key");
    if (key) must(await supabase.from("estimate_request_statuses").update(fields).eq("key", key));
    else {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || `status_${Date.now()}`;
      must(await supabase.from("estimate_request_statuses").insert({ key: slug, ...fields }));
    }
    revalidatePath("/settings/estimate-statuses");
    revalidatePath("/estimate-requests");
  });
}

export async function deleteReqStatus(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const key = str(form, "key");
    const { count } = await supabase.from("estimate_requests").select("id", { count: "exact", head: true }).eq("status", key ?? "");
    if (count) throw new Error(`${count} request${count === 1 ? " uses" : "s use"} this status — move them to another status first.`);
    must(await supabase.from("estimate_request_statuses").delete().eq("key", key ?? ""));
    revalidatePath("/settings/estimate-statuses");
  });
}

// ───────────── Proposal templates ─────────────
export async function saveProposalTemplate(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const name = (str(form, "name") ?? "").slice(0, 120);
    const content = (str(form, "content") ?? "").slice(0, 20000);
    if (!name || !content) throw new Error("Give the template a name and some content.");
    const id = num(form, "id");
    if (id) must(await supabase.from("proposal_templates").update({ name, content }).eq("id", id));
    else must(await supabase.from("proposal_templates").insert({ name, content }));
    revalidatePath("/settings/proposal-templates");
  });
}

export async function deleteProposalTemplate(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("proposal_templates").delete().eq("id", num(form, "id") ?? 0));
    revalidatePath("/settings/proposal-templates");
  });
}

// ───────────── Contract templates & expiry reminders ─────────────
export async function saveContractTemplate(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const name = (str(form, "name") ?? "").slice(0, 120);
    const content = (str(form, "content") ?? "").slice(0, 20000);
    if (!name || !content) throw new Error("Give the template a name and some terms.");
    const id = num(form, "id");
    if (id) must(await supabase.from("contract_templates").update({ name, content }).eq("id", id));
    else must(await supabase.from("contract_templates").insert({ name, content }));
    revalidatePath("/settings/contracts");
  });
}

export async function deleteContractTemplate(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("contract_templates").delete().eq("id", num(form, "id") ?? 0));
    revalidatePath("/settings/contracts");
  });
}

export async function saveContractExpiry(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const days = form.get("auto") === "on" ? Math.min(90, Math.max(1, Math.round(num(form, "days") ?? 7))) : null;
    must(await supabase.from("company_settings").update({ contract_expiry_days: days }).eq("id", true));
    revalidatePath("/settings/contracts");
  });
}

// ───────────── Knowledge base groups & public help center ─────────────
export async function saveKbGroup(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    const name = (str(form, "name") ?? "").slice(0, 120);
    if (!name) throw new Error("Give the group a name.");
    const color = /^#[0-9a-fA-F]{6}$/.test(str(form, "color") ?? "") ? str(form, "color")! : "#0d9488";
    const fields = {
      name,
      description: (str(form, "description") ?? "").slice(0, 300) || null,
      color,
      position: Math.round(num(form, "position") ?? 0),
      is_active: form.get("is_active") === "on",
    };
    const id = num(form, "id");
    if (id) must(await supabase.from("kb_groups").update(fields).eq("id", id));
    else must(await supabase.from("kb_groups").insert({ ...fields, is_active: true }));
    revalidatePath("/settings/support");
    revalidatePath("/knowledge-base");
  });
}

export async function saveKbPublic(form: FormData) {
  return withFlash(async () => {
    const { supabase } = await requireAdmin();
    must(await supabase.from("company_settings").update({ kb_public: form.get("kb_public") === "on" }).eq("id", true));
    revalidatePath("/settings/support");
    revalidatePath("/knowledge-base");
  });
}
