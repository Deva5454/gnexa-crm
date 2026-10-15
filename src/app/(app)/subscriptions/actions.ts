"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { assertAccess, denied, requireStaff } from "@/lib/auth";
import { num, str } from "@/lib/utils";

export type FormState = { error?: string } | undefined;

const today = () => new Date().toISOString().slice(0, 10);

export async function saveSubscription(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { supabase, can, roleName } = await requireStaff();
  if (!can("sales", "edit")) return denied(roleName, "sales", "edit");
  const unit = ["week", "month", "year"].includes(str(form, "interval_unit") ?? "") ? str(form, "interval_unit")! : "month";
  const f = {
    customer_id: num(form, "customer_id") ?? 0,
    name: str(form, "name") ?? "",
    description: str(form, "description"),
    item_id: num(form, "item_id"),
    quantity: num(form, "quantity") ?? 1,
    unit_price: num(form, "unit_price") ?? -1,
    tax_rate: num(form, "tax_rate") ?? 0,
    interval_count: Math.round(num(form, "interval_count") ?? 1),
    interval_unit: unit,
    ends_after_cycles: Math.round(num(form, "ends_after_cycles") ?? 0) || null,
    auto_charge: form.get("auto_charge") === "on",
  };
  if (!f.customer_id) return { error: "Choose a customer." };
  if (!f.name) return { error: "Name the plan." };
  if (f.unit_price < 0) return { error: "Enter a price." };
  if (f.quantity <= 0) return { error: "Quantity must be more than zero." };
  if (f.interval_count < 1 || f.interval_count > 36) return { error: "Billing interval must be between 1 and 36." };

  let subId = id;
  if (id) {
    const { error } = await supabase.from("subscriptions").update(f).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const start = str(form, "start_date") ?? today();
    const { data, error } = await supabase.from("subscriptions").insert({ ...f, start_date: start, next_billing_date: start }).select("id").single();
    if (error) return { error: error.message };
    subId = data.id;
    await logActivity(supabase, `started subscription “${f.name}”`, { type: "customer", id: f.customer_id });
    await supabase.rpc("run_recurring"); // bills the first period if it starts today or earlier
  }
  revalidatePath("/subscriptions");
  redirect(`/subscriptions/${subId}`);
}

export async function setSubscriptionStatus(form: FormData) {
  const { supabase } = await assertAccess("sales", "edit");
  const id = Number(str(form, "id"));
  const to = str(form, "to");
  const { data: s } = await supabase.from("subscriptions").select("name, customer_id, status, next_billing_date").eq("id", id).single();
  if (!s) return;
  if (to === "paused" && s.status === "active") await supabase.from("subscriptions").update({ status: "paused" }).eq("id", id);
  else if (to === "active" && s.status === "paused") {
    // Don't back-bill the paused period: resume from today
    const next = s.next_billing_date && s.next_billing_date > today() ? s.next_billing_date : today();
    await supabase.from("subscriptions").update({ status: "active", next_billing_date: next }).eq("id", id);
    await supabase.rpc("run_recurring");
  } else if (to === "cancelled" && (s.status === "active" || s.status === "paused"))
    await supabase.from("subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString(), next_billing_date: null }).eq("id", id);
  else return;
  const verb = to === "paused" ? "paused" : to === "active" ? "resumed" : "cancelled";
  await logActivity(supabase, `${verb} subscription “${s.name}”`, { type: "customer", id: s.customer_id });
  revalidatePath(`/subscriptions/${id}`);
  revalidatePath("/subscriptions");
}

/** Raise the next period's invoice right away instead of waiting for the billing date. */
export async function billNow(form: FormData) {
  const { supabase } = await assertAccess("sales", "edit");
  const id = Number(str(form, "id"));
  const { data: s } = await supabase.from("subscriptions").select("status, next_billing_date").eq("id", id).single();
  if (!s || s.status !== "active") return;
  if (!s.next_billing_date || s.next_billing_date > today()) await supabase.from("subscriptions").update({ next_billing_date: today() }).eq("id", id);
  await supabase.rpc("run_recurring");
  revalidatePath(`/subscriptions/${id}`);
  revalidatePath("/subscriptions");
}

export async function deleteSubscription(form: FormData) {
  const { supabase } = await assertAccess("sales", "full");
  await supabase.from("subscriptions").delete().eq("id", Number(str(form, "id")));
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}
