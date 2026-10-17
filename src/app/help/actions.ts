"use server";

import { createClient } from "@/lib/supabase/server";

/** A view or vote from the public help center (the database ignores anything it doesn't show publicly). */
export async function trackPublicArticle(slug: string, event: "view" | "yes" | "no") {
  if (!["view", "yes", "no"].includes(event) || slug.length > 200) return;
  const supabase = await createClient();
  await supabase.rpc("public_kb_track", { p_slug: slug, p_event: event });
}
