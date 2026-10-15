import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { TagChip } from "@/components/crm/tag-editor";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteTag, saveTag } from "@/lib/actions/tags";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsSettingsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: tags }, { data: uses }] = await Promise.all([
    supabase.from("tags").select("id, name, color").order("name"),
    supabase.from("taggables").select("tag_id"),
  ]);
  const used = new Map<number, number>();
  for (const u of uses ?? []) used.set(u.tag_id, (used.get(u.tag_id) ?? 0) + 1);

  return (
    <Card>
      <CardHeader title="Tags" description="Label customers, leads, tasks, projects and tickets. Anyone on the team can add new tags while tagging; manage them here." />
      <ul className="divide-y divide-slate-100">
        {(tags ?? []).map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
            <form action={saveTag} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input type="color" name="color" defaultValue={t.color} className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5" aria-label={`Colour for ${t.name}`} />
              <input name="name" defaultValue={t.name} required maxLength={40} className="field max-w-[14rem]" aria-label="Tag name" />
              <TagChip tag={t} />
              <span className="text-xs text-slate-400">{used.get(t.id) ?? 0} use{used.get(t.id) === 1 ? "" : "s"}</span>
              <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
            </form>
            <ConfirmForm action={deleteTag} message={`Delete the tag “${t.name}”? It is removed from ${used.get(t.id) ?? 0} record(s).`}>
              <input type="hidden" name="id" value={t.id} />
              <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${t.name}`}><Trash2 className="h-4 w-4" /></button>
            </ConfirmForm>
          </li>
        ))}
        {!tags?.length && <li className="px-5 py-4 text-sm text-slate-400">No tags yet.</li>}
      </ul>
      <form action={saveTag} className="flex gap-2 border-t border-slate-100 p-4">
        <input type="color" name="color" defaultValue="#6d55f2" className="h-9 w-11 cursor-pointer rounded border border-slate-200 bg-white p-0.5" aria-label="Colour" />
        <input name="name" required maxLength={40} placeholder="New tag…" className="field" />
        <Button variant="secondary"><Plus className="h-4 w-4" /> Add</Button>
      </form>
    </Card>
  );
}
