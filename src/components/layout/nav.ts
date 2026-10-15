import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Megaphone,
  Target,
  Building2,
  CreditCard,
  FileSignature,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Magnet,
  Package,
  Receipt,
  ReceiptText,
  Settings,
  Wallet,
  type LucideIcon,
  ScrollText,
  SquareCheckBig,
  Repeat,
  Mails,
  Newspaper,
  Inbox,
  ClipboardList,
  Images,
  FileStack,
} from "lucide-react";
import type { Module } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean; adminOnly?: boolean; module?: Module };

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/customers", label: "Customers", icon: Building2, module: "customers" },
      { href: "/leads", label: "Leads", icon: Magnet, module: "leads" },
      { href: "/tasks", label: "Tasks", icon: ListChecks, module: "tasks" },
      { href: "/todos", label: "To-do", icon: SquareCheckBig },
      { href: "/newsfeed", label: "Newsfeed", icon: Newspaper },
    ],
  },
  {
    section: "Sales",
    items: [
      { href: "/estimate-requests", label: "Estimate requests", icon: Inbox, module: "sales" },
      { href: "/sales/proposals", label: "Proposals", icon: FileSignature, module: "sales" },
      { href: "/sales/estimates", label: "Estimates", icon: FileText, module: "sales" },
      { href: "/sales/invoices", label: "Invoices", icon: ReceiptText, module: "sales" },
      { href: "/sales/payments", label: "Payments", icon: Wallet, module: "sales" },
      { href: "/sales/credit-notes", label: "Credit notes", icon: CreditCard, module: "sales" },
      { href: "/subscriptions", label: "Subscriptions", icon: Repeat, module: "sales" },
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
    section: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
      { href: "/goals", label: "Goals", icon: Target, module: "reports" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    section: "Utilities",
    items: [
      { href: "/media", label: "Media library", icon: Images },
      { href: "/surveys", label: "Surveys", icon: ClipboardList },
      { href: "/bulk-pdf", label: "Bulk PDF export", icon: FileStack, module: "sales" },
      { href: "/emails", label: "E-mail log", icon: Mails, module: "sales" },
    ],
  },
  {
    section: "Admin",
    items: [{ href: "/settings", label: "Setup", icon: Settings, adminOnly: true }],
  },
];
