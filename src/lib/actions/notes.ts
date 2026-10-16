"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { str } from "@/lib/utils";

const PATHS = { customer: "/customers", lead: "/leads" } as const;
const MODULE = { customer: "customers", lead: "leads" } as const;

export async function addNote(form: FormData) {
  const { supabase, can } = await requireStaff();
  const relType = str(form, "rel_type") as keyof typeof PATHS | null;
  const relId = Number(str(form, "rel_id"));
  const body = str(form, "body");
  if (!relType || !(relType in PATHS) || !relId || !body) return;
  if (!can(MODULE[relType], "view")) return;
  await supabase.from("notes").insert({ rel_type: relType, rel_id: relId, body });
  if (relType === "lead") await supabase.from("leads").update({ last_contact_at: new Date().toISOString() }).eq("id", relId);
  revalidatePath(`${PATHS[relType]}/${relId}`);
}

export async function deleteNote(form: FormData) {
  const { supabase } = await requireStaff();
  const id = Number(str(form, "id"));
  const { data } = await supabase.from("notes").delete().eq("id", id).select("rel_type, rel_id").maybeSingle();
  const relType = data?.rel_type as keyof typeof PATHS | undefined;
  if (data && relType && relType in PATHS) revalidatePath(`${PATHS[relType]}/${data.rel_id}`);
}
