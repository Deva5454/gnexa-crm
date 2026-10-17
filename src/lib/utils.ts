import { formatConfig } from "@/lib/format-config";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A date in the format chosen in Setup → Settings → Numbering & dates (default "17 Oct 2026"). */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  const f = formatConfig().dateFormat;
  if (f === "dd MMM yyyy") return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  switch (f) {
    case "dd/MM/yyyy": return `${dd}/${mm}/${y}`;
    case "MM/dd/yyyy": return `${mm}/${dd}/${y}`;
    case "yyyy-MM-dd": return `${y}-${mm}-${dd}`;
    case "dd-MM-yyyy": return `${dd}-${mm}-${y}`;
    default: return `${dd}.${mm}.${y}`;
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  if (formatConfig().dateFormat !== "dd MMM yyyy") {
    return `${formatDate(value)}, ${new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value: string) {
  const secs = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let n = secs;
  for (const [step, unit] of units) {
    if (Math.abs(n) < step) {
      const v = Math.max(1, Math.floor(n));
      return `${v} ${unit}${v === 1 ? "" : "s"} ago`;
    }
    n /= step;
  }
  return "";
}

export function formatMoney(value: number | null | undefined, currency = "INR") {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Read a trimmed string field from FormData; empty → null. */
export function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const PAGE_SIZE = 20;

/** Escape characters that have meaning inside a PostgREST `or=(...)` ilike filter. */
export function searchTerm(q: string) {
  return q.replace(/[%_,()\\*]/g, " ").trim();
}
