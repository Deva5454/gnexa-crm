import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DatabaseBackup,
  FileCode2,
  FileSignature,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderKanban,
  Images,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Magnet,
  Mails,
  Megaphone,
  Newspaper,
  Package,
  Receipt,
  ReceiptText,
  Repeat,
  ScrollText,
  Settings,
  SquareCheckBig,
  Target,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Module } from "@/lib/permissions";

/** Features that can be switched off in Setup → Modules (the permission modules plus these). */
export const FEATURES = ["newsfeed", "todos", "estimate_requests", "subscriptions", "surveys", "media", "calendar", "goals", "announcements"] as const;
export type Feature = (typeof FEATURES)[number];

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** hidden when the role can't view this module (or it's switched off) */
  module?: Module;
  /** hidden when this feature is switched off in Setup → Modules */
  feature?: Feature;
  /** a collapsible group (Utilities, Reports) */
  children?: NavItem[];
  soon?: boolean;
};

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/customers", label: "Customers", icon: Building2, module: "customers" },
      { href: "/leads", label: "Leads", icon: Magnet, module: "leads" },
      { href: "/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
      { href: "/todos", label: "To-do", icon: SquareCheckBig, feature: "todos" },
      { href: "/newsfeed", label: "Newsfeed", icon: Newspaper, feature: "newsfeed" },
    ],
  },
  {
    section: "Sales",
    items: [
      { href: "/estimate-requests", label: "Estimate requests", icon: Inbox, module: "sales", feature: "estimate_requests" },
      { href: "/sales/proposals", label: "Proposals", icon: FileSignature, module: "sales" },
      { href: "/sales/estimates", label: "Estimates", icon: FileText, module: "sales" },
      { href: "/sales/invoices", label: "Invoices", icon: ReceiptText, module: "sales" },
      { href: "/sales/payments", label: "Payments", icon: Wallet, module: "sales" },
      { href: "/sales/credit-notes", label: "Credit notes", icon: CreditCard, module: "sales" },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat, module: "sales", feature: "subscriptions" },
      { href: "/sales/items", label: "Items", icon: Package, module: "sales" },
      { href: "/expenses", label: "Expenses", icon: Receipt, module: "expenses" },
    ],
  },
  {
    section: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban, module: "projects" },
      { href: "/contracts", label: "Contracts", icon: ScrollText, module: "contracts" },
      { href: "/support", label: "Support", icon: LifeBuoy, module: "support" },
      { href: "/knowledge-base", label: "Knowledge base", icon: BookOpen, module: "knowledge_base" },
    ],
  },
  {
    section: "Tools",
    items: [
      {
        href: "#utilities",
        label: "Utilities",
        icon: Wrench,
        children: [
          { href: "/media", label: "Media", icon: Images, feature: "media" },
          { href: "/bulk-pdf", label: "Bulk PDF export", icon: FileStack, module: "sales" },
          { href: "/einvoice", label: "e-Invoice export", icon: FileCode2, module: "sales" },
          { href: "/csv-export", label: "CSV export", icon: FileSpreadsheet },
          { href: "/calendar", label: "Calendar", icon: CalendarDays, feature: "calendar" },
          { href: "/announcements", label: "Announcements", icon: Megaphone, feature: "announcements" },
          { href: "/goals", label: "Goals", icon: Target, module: "reports", feature: "goals" },
          { href: "/activity", label: "Activity log", icon: Activity, adminOnly: true },
          { href: "/surveys", label: "Surveys", icon: ClipboardList, feature: "surveys" },
          { href: "/backup", label: "Database backup", icon: DatabaseBackup, adminOnly: true },
          { href: "/emails", label: "E-mail log", icon: Mails, module: "sales" },
        ],
      },
      {
        href: "#reports",
        label: "Reports",
        icon: BarChart3,
        module: "reports",
        children: [
          { href: "/reports?tab=sales", label: "Sales", icon: BarChart3, module: "sales" },
          { href: "/reports?tab=expenses", label: "Expenses", icon: BarChart3, module: "expenses" },
          { href: "/reports?tab=income", label: "Expenses vs income", icon: BarChart3, module: "expenses" },
          { href: "/reports?tab=leads", label: "Leads", icon: BarChart3, module: "leads" },
          { href: "/reports?tab=time", label: "Timesheets overview", icon: BarChart3, module: "projects" },
          { href: "/reports?tab=kb", label: "KB articles", icon: BarChart3, module: "knowledge_base" },
          { href: "/reports?tab=support", label: "Support", icon: BarChart3, module: "support" },
        ],
      },
    ],
  },
  {
    section: "Admin",
    items: [{ href: "/settings", label: "Setup", icon: Settings, adminOnly: true }],
  },
];

/** Setup → Menu setup: { order: { [section or group href]: [hrefs…] }, hidden: [hrefs…] } */
export type MenuConfig = { order?: Record<string, string[]>; hidden?: string[] };

export function readMenuConfig(raw: unknown): MenuConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const order: Record<string, string[]> = {};
  if (r.order && typeof r.order === "object" && !Array.isArray(r.order))
    for (const [k, v] of Object.entries(r.order as Record<string, unknown>)) if (Array.isArray(v)) order[k] = v.filter((x): x is string => typeof x === "string");
  const hidden = Array.isArray(r.hidden) ? r.hidden.filter((x): x is string => typeof x === "string") : [];
  return { order, hidden };
}

/** Apply the saved order (unknown items keep their place at the end) and hide what was hidden. */
export function arrange<T extends { href: string }>(items: T[], key: string, cfg: MenuConfig): T[] {
  const want = cfg.order?.[key] ?? [];
  const rank = (h: string) => {
    const i = want.indexOf(h);
    return i < 0 ? want.length + items.findIndex((x) => x.href === h) : i;
  };
  return [...items].filter((i) => !cfg.hidden?.includes(i.href)).sort((a, b) => rank(a.href) - rank(b.href));
}
