"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tag } from "lucide-react";
import type { TagLite } from "./tag-editor";

/** "Filter by tag" dropdown that writes ?tag= into the URL (and resets paging). */
export function TagFilter({ tags }: { tags: TagLite[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get("tag") ?? "";
  return (
    <label className="relative inline-flex items-center">
      <Tag className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
      <select
        aria-label="Filter by tag"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.delete("page");
          if (e.target.value) next.set("tag", e.target.value);
          else next.delete("tag");
          const qs = next.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
        className={`h-8 appearance-none rounded-full border-0 py-0 pl-7 pr-7 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-brand-300 ${value ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-600 ring-slate-200"}`}
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </label>
  );
}
