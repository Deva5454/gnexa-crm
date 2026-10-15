// Shared by server and client: document kinds, numbering, totals and status rules.

export type DocKind = "proposal" | "estimate" | "invoice" | "credit_note";
export type DocStatus = "draft" | "sent" | "accepted" | "declined" | "cancelled";

export const KINDS: Record<
  DocKind,
  { slug: string; label: string; plural: string; prefix: string; dueLabel: string | null; partyLabel: string; blurb: string }
> = {
  proposal: { slug: "proposals", label: "Proposal", plural: "Proposals", prefix: "PRO", dueLabel: "Open till", partyLabel: "To", blurb: "Pitch a solution to a lead or customer." },
  estimate: { slug: "estimates", label: "Estimate", plural: "Estimates", prefix: "EST", dueLabel: "Expiry date", partyLabel: "Estimate for", blurb: "Quote prices before you invoice." },
  invoice: { slug: "invoices", label: "Invoice", plural: "Invoices", prefix: "INV", dueLabel: "Due date", partyLabel: "Bill to", blurb: "Bill customers and track what's been paid." },
  credit_note: { slug: "credit-notes", label: "Credit note", plural: "Credit notes", prefix: "CN", dueLabel: null, partyLabel: "Credit to", blurb: "Refunds and credits you can apply to invoices." },
};

export const KIND_ORDER: DocKind[] = ["proposal", "estimate", "invoice", "credit_note"];

export function kindFromSlug(slug: string): DocKind | null {
  return KIND_ORDER.find((k) => KINDS[k].slug === slug) ?? null;
}

export function docNumber(kind: DocKind, number: number) {
  return `${KINDS[kind].prefix}-${String(number).padStart(5, "0")}`;
}

export const docHref = (kind: DocKind, id: number) => `/sales/${KINDS[kind].slug}/${id}`;

// ───────────── Totals ─────────────
export type Line = {
  item_id?: number | null;
  description: string;
  long_description?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
  tax_rate: number;
  /** Set when the line bills a customer expense */
  expense_id?: number | null;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Discount is a % of the subtotal applied before tax; tax is charged per line on the discounted amount. */
export function computeTotals(lines: Line[], discountPercent: number, adjustment: number) {
  const d = Math.min(100, Math.max(0, discountPercent || 0)) / 100;
  let subtotal = 0;
  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const l of lines) {
    const amount = (l.qty || 0) * (l.rate || 0);
    subtotal += amount;
    const taxable = amount * (1 - d);
    const tax = (taxable * (l.tax_rate || 0)) / 100;
    if (l.tax_rate > 0) {
      const cur = byRate.get(l.tax_rate) ?? { taxable: 0, tax: 0 };
      byRate.set(l.tax_rate, { taxable: cur.taxable + taxable, tax: cur.tax + tax });
    }
  }
  const taxes = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, taxable: r2(v.taxable), amount: r2(v.tax) }));
  const tax_total = r2(taxes.reduce((s, t) => s + t.amount, 0));
  const discount_total = r2(subtotal * d);
  subtotal = r2(subtotal);
  const total = r2(subtotal - discount_total + tax_total + (adjustment || 0));
  return { subtotal, discount_total, tax_total, total, taxes };
}

// ───────────── Status ─────────────
export type StatusView = { key: string; label: string; color: string };

const C = {
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  dark: "bg-slate-800 text-white ring-slate-800",
};

export function docStatus(
  doc: { kind: DocKind; status: string; due_date: string | null; total: number },
  bal?: { paid: number; credited: number; credit_used: number; balance: number } | null,
  today = new Date().toISOString().slice(0, 10),
): StatusView {
  if (doc.status === "cancelled") return { key: "cancelled", label: "Cancelled", color: C.dark };
  if (doc.status === "draft") return { key: "draft", label: "Draft", color: C.slate };

  if (doc.kind === "invoice") {
    const balance = bal?.balance ?? doc.total;
    const received = (bal?.paid ?? 0) + (bal?.credited ?? 0);
    if (balance <= 0.005) return { key: "paid", label: "Paid", color: C.green };
    if (doc.due_date && doc.due_date < today) return { key: "overdue", label: "Overdue", color: C.rose };
    if (received > 0) return { key: "partial", label: "Partially paid", color: C.amber };
    return { key: "unpaid", label: "Unpaid", color: C.sky };
  }
  if (doc.kind === "credit_note") {
    const remaining = bal?.balance ?? doc.total;
    return remaining <= 0.005 ? { key: "closed", label: "Closed", color: C.slate } : { key: "open", label: "Open", color: C.violet };
  }
  if (doc.status === "accepted") return { key: "accepted", label: "Accepted", color: C.green };
  if (doc.status === "declined") return { key: "declined", label: "Declined", color: C.rose };
  if (doc.due_date && doc.due_date < today) return { key: "expired", label: "Expired", color: C.amber };
  return { key: "sent", label: "Sent", color: C.sky };
}

/** Filter chips per kind: key matches docStatus().key */
export const STATUS_FILTERS: Record<DocKind, { key: string; label: string }[]> = {
  invoice: [
    { key: "unpaid", label: "Unpaid" },
    { key: "partial", label: "Partially paid" },
    { key: "overdue", label: "Overdue" },
    { key: "paid", label: "Paid" },
    { key: "draft", label: "Draft" },
    { key: "cancelled", label: "Cancelled" },
  ],
  estimate: [
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "accepted", label: "Accepted" },
    { key: "declined", label: "Declined" },
    { key: "expired", label: "Expired" },
  ],
  proposal: [
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "accepted", label: "Accepted" },
    { key: "declined", label: "Declined" },
    { key: "expired", label: "Expired" },
  ],
  credit_note: [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "draft", label: "Draft" },
  ],
};

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** date + n days/weeks/months/years. Months clamp to the month's last day (31 Jan + 1 month = 28/29 Feb), like Postgres. */
export function addInterval(iso: string, n: number, unit: string) {
  if (unit === "day") return addDays(iso, n);
  if (unit === "week") return addDays(iso, n * 7);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const months = unit === "year" ? n * 12 : n;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export const INTERVAL_LABEL = (n: number, unit: string) => (n === 1 ? unit : `${n} ${unit}s`);

/** An invoice line that bills a customer expense (amount before tax, with its GST rate). */
export function expenseLine(e: { id: number; name: string; date: string; amount: number; tax_rate: number; category: string | null }): Line {
  const d = new Date(`${e.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  return { expense_id: e.id, item_id: null, description: e.name, long_description: [e.category, `expense of ${d}`].filter(Boolean).join(" · "), qty: 1, unit: "", rate: Number(e.amount), tax_rate: Number(e.tax_rate) };
}
