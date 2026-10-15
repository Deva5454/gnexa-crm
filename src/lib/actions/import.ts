"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { requireStaff } from "@/lib/auth";
import type { ImportResult } from "@/lib/csv";

const clean = (v: string | undefined, max = 200) => {
  const t = (v ?? "").trim().slice(0, max);
  return t === "" ? null : t;
};
const emailOk = (e: string | null) => !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export async function importCustomers(rows: Record<string, string>[]): Promise<ImportResult> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("customers", "edit")) return { created: 0, skipped: [], error: `The ${roleName} role can't add customers.` };
  if (rows.length > 500) return { created: 0, skipped: [], error: "Import at most 500 rows at a time." };
  const [{ data: existing }, { data: groups }] = await Promise.all([
    supabase.from("customers").select("company"),
    supabase.from("customer_groups").select("id, name"),
  ]);
  const seen = new Set((existing ?? []).map((c) => c.company.toLowerCase()));
  const skipped: ImportResult["skipped"] = [];
  let created = 0;
  for (const [i, r] of rows.entries()) {
    const company = clean(r.company, 160);
    const row = i + 2;
    if (!company) { skipped.push({ row, reason: "no company name" }); continue; }
    if (seen.has(company.toLowerCase())) { skipped.push({ row, reason: `${company} already exists` }); continue; }
    const email = clean(r.contact_email, 160)?.toLowerCase() ?? null;
    if (!emailOk(email)) { skipped.push({ row, reason: `invalid e-mail “${email}”` }); continue; }
    const group = groups?.find((g) => g.name.toLowerCase() === (r.group ?? "").trim().toLowerCase());
    const cur = clean(r.currency, 3)?.toUpperCase() ?? null;
    const { data: c, error } = await supabase
      .from("customers")
      .insert({
        company,
        phone: clean(r.phone, 40),
        website: clean(r.website),
        address: clean(r.address, 300),
        city: clean(r.city, 80),
        state: clean(r.state, 80),
        zip: clean(r.zip, 20),
        country: clean(r.country, 80),
        vat: clean(r.vat, 30),
        currency: cur && /^[A-Z]{3}$/.test(cur) ? cur : null,
        group_id: group?.id ?? null,
      })
      .select("id")
      .single();
    if (error) { skipped.push({ row, reason: error.message }); continue; }
    const first = clean(r.contact_first_name, 80);
    if (first) await supabase.from("contacts").insert({ customer_id: c.id, first_name: first, last_name: clean(r.contact_last_name, 80), email, phone: clean(r.contact_phone, 40), is_primary: true });
    seen.add(company.toLowerCase());
    created++;
  }
  if (created) await logActivity(supabase, `imported ${created} customer${created === 1 ? "" : "s"} from CSV`);
  revalidatePath("/customers");
  return { created, skipped };
}

export async function importLeads(rows: Record<string, string>[]): Promise<ImportResult> {
  const { supabase, can, roleName, profile } = await requireStaff();
  if (!can("leads", "edit")) return { created: 0, skipped: [], error: `The ${roleName} role can't add leads.` };
  if (rows.length > 500) return { created: 0, skipped: [], error: "Import at most 500 rows at a time." };
  const [{ data: existing }, { data: statuses }, { data: sources }] = await Promise.all([
    supabase.from("leads").select("email").not("email", "is", null),
    supabase.from("lead_statuses").select("id, name, sort_order").order("sort_order"),
    supabase.from("lead_sources").select("id, name"),
  ]);
  const seen = new Set((existing ?? []).map((l) => l.email!.toLowerCase()));
  const skipped: ImportResult["skipped"] = [];
  let created = 0;
  let pos = Date.now() / 1000;
  for (const [i, r] of rows.entries()) {
    const row = i + 2;
    const name = clean(r.name, 120);
    if (!name) { skipped.push({ row, reason: "no name" }); continue; }
    const email = clean(r.email, 160)?.toLowerCase() ?? null;
    if (!emailOk(email)) { skipped.push({ row, reason: `invalid e-mail “${email}”` }); continue; }
    if (email && seen.has(email)) { skipped.push({ row, reason: `${email} is already a lead` }); continue; }
    const value = r.value ? Number(String(r.value).replace(/[^\d.]/g, "")) : null;
    const status = statuses?.find((s) => s.name.toLowerCase() === (r.status ?? "").trim().toLowerCase()) ?? statuses?.[0];
    const source = sources?.find((s) => s.name.toLowerCase() === (r.source ?? "").trim().toLowerCase());
    const { error } = await supabase.from("leads").insert({
      name,
      company: clean(r.company, 160),
      title: clean(r.title, 80),
      email,
      phone: clean(r.phone, 40),
      city: clean(r.city, 80),
      country: clean(r.country, 80),
      value: value != null && Number.isFinite(value) ? value : null,
      description: clean(r.description, 4000),
      status_id: status?.id ?? null,
      source_id: source?.id ?? null,
      assigned_to: profile.id,
      position: pos++,
    });
    if (error) { skipped.push({ row, reason: error.message }); continue; }
    if (email) seen.add(email);
    created++;
  }
  if (created) await logActivity(supabase, `imported ${created} lead${created === 1 ? "" : "s"} from CSV`);
  revalidatePath("/leads");
  return { created, skipped };
}
