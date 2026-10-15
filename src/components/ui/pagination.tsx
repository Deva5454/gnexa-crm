import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = (disabled: boolean) =>
    cn(
      "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600",
      disabled ? "pointer-events-none opacity-40" : "hover:bg-slate-50",
    );
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-slate-500">
      <span>
        Showing <b className="text-slate-700">{from}</b>–<b className="text-slate-700">{to}</b> of{" "}
        <b className="text-slate-700">{total}</b>
      </span>
      <div className="flex items-center gap-2">
        <Link aria-label="Previous page" href={href(page - 1)} className={linkCls(page <= 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span>
          Page {page} / {pages}
        </span>
        <Link aria-label="Next page" href={href(page + 1)} className={linkCls(page >= pages)}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
