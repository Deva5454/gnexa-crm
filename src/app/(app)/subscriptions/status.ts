export const SUB_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  paused: { label: "Paused", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-600 ring-slate-200" },
  completed: { label: "Completed", color: "bg-sky-50 text-sky-700 ring-sky-200" },
};

/** What a plan is worth per month, before tax. */
export function monthly(s: { unit_price: number; quantity: number; interval_count: number; interval_unit: string }) {
  const amount = Number(s.unit_price) * Number(s.quantity);
  const months = s.interval_unit === "year" ? 12 * s.interval_count : s.interval_unit === "week" ? (s.interval_count * 12) / 52 : s.interval_count;
  return amount / months;
}

export const withTax = (s: { unit_price: number; quantity: number; tax_rate: number }) =>
  Number(s.unit_price) * Number(s.quantity) * (1 + Number(s.tax_rate) / 100);
