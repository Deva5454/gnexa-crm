import {
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
    ],
  },
  {
    section: "Sales",
    items: [
      { href: "/sales/proposals", label: "Proposals", icon: FileSignature, module: "sales" },
      { href: "/sales/estimates", label: "Estimates", icon: FileText, module: "sales" },
      { href: "/sales/invoices", label: "Invoices", icon: ReceiptText, module: "sales" },
      { href: "/sales/payments", label: "Payments", icon: Wallet, module: "sales" },
      { href: "/sales/credit-notes", label: "Credit notes", icon: CreditCard, module: "sales" },
      { href: "/sales/items", label: "Items", icon: Package, module: "sales" },
      { href: "/expenses", label: "Expenses", icon: Receipt, module: "expenses" },
    ],
  },
  {
    section: "Coming next",
    items: [
      { href: "#", label: "Projects", icon: FolderKanban, soon: true },
      { href: "#", label: "Contracts", icon: ScrollText, soon: true },
      { href: "#", label: "Support", icon: LifeBuoy, soon: true },
    ],
  },
  {
    section: "Admin",
    items: [{ href: "/settings", label: "Setup", icon: Settings, adminOnly: true }],
  },
];
