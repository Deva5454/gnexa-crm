"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addTag, removeTag } from "@/lib/actions/tags";
import type { TagType } from "@/lib/links";
import { cn } from "@/lib/utils";

export type TagLite = { id: number; name: string; color: string };

export function TagChip({ tag, onRemove, className }: { tag: TagLite; onRemove?: () => void; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold", className)}
      style={{ backgroundColor: `${tag.color}1f`, color: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-0.5 rounded hover:bg-black/5" aria-label={`Remove tag ${tag.name}`}>
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function TagEditor({
  relType,
  relId,
  path,
  tags,
  allTags,
  canEdit,
}: {
  relType: TagType;
  relId: number;
  path: string;
  tags: TagLite[];
  allTags: TagLite[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listId = `tags-${relType}-${relId}`;
  const suggestions = allTags.filter((t) => !tags.some((x) => x.id === t.id));

  const submit = (name: string) => {
    if (!name.trim()) return;
    start(async () => {
      const res = await addTag(relType, relId, name, path);
      setError(res.error ?? null);
      if (!res.error) {
        setValue("");
        setAdding(false);
      }
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", pending && "opacity-60")}>
      {tags.map((t) => (
        <TagChip key={t.id} tag={t} onRemove={canEdit ? () => start(() => removeTag(relType, relId, t.id, path)) : undefined} />
      ))}
      {!tags.length && !adding && <span className="text-xs text-slate-400">No tags</span>}
      {canEdit &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
            }}
            className="flex items-center gap-1"
          >
            <input
              list={listId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => !value && setAdding(false)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder="Tag name"
              maxLength={40}
              autoFocus
              className="h-7 w-32 rounded-md border border-slate-200 px-2 text-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <datalist id={listId}>
              {suggestions.map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
            <button className="h-7 rounded-md bg-brand-600 px-2 text-xs font-semibold text-white hover:bg-brand-700">Add</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex h-6 items-center gap-0.5 rounded-md border border-dashed border-slate-300 px-1.5 text-[11px] font-medium text-slate-500 hover:border-brand-300 hover:text-brand-700">
            <Plus className="h-3 w-3" /> Tag
          </button>
        ))}
      {error && <span className="w-full text-xs text-rose-600">{error}</span>}
    </div>
  );
}
