import {
  LayoutDashboard,
  Building2,
  Magnet,
  ListChecks,
  Settings,
  type LucideIcon,
  FileText,
  Receipt,
  FolderKanban,
  LifeBuoy,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean; adminOnly?: boolean };

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/customers", label: "Customers", icon: Building2 },
      { href: "/leads", label: "Leads", icon: Magnet },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    section: "Coming next",
    items: [
      { href: "#", label: "Sales & Invoices", icon: Receipt, soon: true },
      { href: "#", label: "Projects", icon: FolderKanban, soon: true },
      { href: "#", label: "Contracts", icon: FileText, soon: true },
      { href: "#", label: "Support", icon: LifeBuoy, soon: true },
    ],
  },
  {
    section: "Admin",
    items: [{ href: "/settings", label: "Setup", icon: Settings, adminOnly: true }],
  },
];
