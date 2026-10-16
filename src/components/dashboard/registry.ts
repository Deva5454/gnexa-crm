// Dashboard widgets (Perfex parity). Shared by the server page and the client "Dashboard options" editor.

export type WidgetSize = "full" | "wide" | "narrow";
export type WidgetDef = { key: string; label: string; size: WidgetSize };

/** Default order. Wide + narrow pairs share a row on large screens. */
export const WIDGETS: WidgetDef[] = [
  { key: "top_stats", label: "Quick stats", size: "full" },
  { key: "finance_overview", label: "Finance overview", size: "full" },
  { key: "user_data", label: "My work (tasks, projects, reminders, tickets, announcements, activity)", size: "wide" },
  { key: "calendar", label: "Upcoming events", size: "narrow" },
  { key: "payments_chart", label: "Payment records", size: "wide" },
  { key: "todos", label: "My to-do items", size: "narrow" },
  { key: "leads_overview", label: "Leads overview", size: "wide" },
  { key: "projects_chart", label: "Statistics by project status", size: "narrow" },
  { key: "tickets_chart", label: "Tickets awaiting reply", size: "wide" },
  { key: "project_activity", label: "Latest project activity", size: "narrow" },
  { key: "goals", label: "Goals", size: "full" },
  { key: "contracts_expiring", label: "Contracts expiring soon", size: "wide" },
  { key: "leads_sources", label: "Leads by source", size: "narrow" },
];

export type DashboardConfig = { order: string[]; hidden: string[] };

export function readDashboardConfig(raw: unknown): DashboardConfig {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const keys = new Set(WIDGETS.map((w) => w.key));
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && keys.has(x)) : []);
  return { order: list(r.order), hidden: list(r.hidden) };
}

/** Widgets in the person's order (new widgets keep their default place at the end), flagged hidden or not. */
export function arrangeWidgets(cfg: DashboardConfig): (WidgetDef & { hidden: boolean })[] {
  const rank = (k: string) => {
    const i = cfg.order.indexOf(k);
    return i < 0 ? cfg.order.length + WIDGETS.findIndex((w) => w.key === k) : i;
  };
  return [...WIDGETS].sort((a, b) => rank(a.key) - rank(b.key)).map((w) => ({ ...w, hidden: cfg.hidden.includes(w.key) }));
}

export const SIZE_CLASS: Record<WidgetSize, string> = {
  full: "xl:col-span-3",
  wide: "xl:col-span-2",
  narrow: "xl:col-span-1",
};
