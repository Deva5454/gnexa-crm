import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PredefinedReplies } from "./predefined-replies";
import { NamedList } from "../named-list";

export const metadata: Metadata = { title: "Support settings" };

export default async function SupportSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: depts }, { data: groups }, { data: replies }] = await Promise.all([
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("kb_groups").select("id, name").order("position"),
    supabase.from("predefined_replies").select("id, title, body").order("title"),
  ]);
  return (
    <>
      <NamedList table="ticket_departments" title="Support departments" description="Route tickets to the right team." items={depts ?? []} />
      <PredefinedReplies replies={replies ?? []} />
      <NamedList table="kb_groups" title="Knowledge base categories" items={groups ?? []} />
    </>
  );
}
