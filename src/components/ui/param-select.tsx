"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** A filter dropdown that writes ?<name>= into the URL (and resets paging). Empty value removes it. */
export function ParamSelect({ name, label, options, allLabel }: { name: string; label: string; options: { value: string; label: string }[]; allLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(name) ?? "";
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.delete("page");
        if (e.target.value) next.set(name, e.target.value);
        else next.delete(name);
        const qs = next.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
      className={cn(
        "h-8 max-w-[11rem] rounded-full border-0 py-0 pl-3 pr-7 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-brand-300",
        value ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-600 ring-slate-200",
      )}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
