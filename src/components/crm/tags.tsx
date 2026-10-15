import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireStaff } from "@/lib/auth";
import type { TagType } from "@/lib/links";
import { TagEditor, type TagLite } from "./tag-editor";

type DB = SupabaseClient<Database>;

/** Tags for many records at once, keyed by record id — for list pages. */
export async function tagsFor(supabase: DB, relType: TagType, ids: number[]) {
  const map = new Map<number, TagLite[]>();
  if (!ids.length) return map;
  const { data } = await supabase.from("taggables").select("rel_id, tag:tags(id, name, color)").eq("rel_type", relType).in("rel_id", ids);
  for (const r of data ?? []) if (r.tag) map.set(r.rel_id, [...(map.get(r.rel_id) ?? []), r.tag]);
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

/** Record ids carrying a tag — for "filter by tag" on list pages. */
export async function idsWithTag(supabase: DB, relType: TagType, tagId: number) {
  const { data } = await supabase.from("taggables").select("rel_id").eq("rel_type", relType).eq("tag_id", tagId);
  return (data ?? []).map((r) => r.rel_id);
}

export async function allTags(supabase: DB) {
  const { data } = await supabase.from("tags").select("id, name, color").order("name");
  return data ?? [];
}

/** Editable tag row for a record's page. */
export async function RecordTags({ relType, relId, path, canEdit }: { relType: TagType; relId: number; path: string; canEdit: boolean }) {
  const { supabase } = await requireStaff();
  const [map, all] = await Promise.all([tagsFor(supabase, relType, [relId]), allTags(supabase)]);
  return <TagEditor relType={relType} relId={relId} path={path} tags={map.get(relId) ?? []} allTags={all} canEdit={canEdit} />;
}
