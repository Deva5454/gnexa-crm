"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Setup sections in the same order as Perfex
const ITEMS: { label: string; href?: string; children?: { href: string; label: string }[] }[] = [
  { label: "Staff", href: "/settings/staff" },
  { label: "Roles", href: "/settings/roles" },
  { label: "Customers", children: [{ href: "/settings/customers", label: "Groups" }, { href: "/settings/tags", label: "Tags" }] },
  { label: "Support", href: "/settings/support" },
  { label: "Leads", href: "/settings/leads" },
  { label: "Finance", children: [{ href: "/settings/finance", label: "Taxes, payments & expenses" }, { href: "/settings/currencies", label: "Currencies" }] },
  { label: "Contracts", href: "/settings/contracts" },
  { label: "Estimate request", children: [{ href: "/settings/web-forms", label: "Forms" }, { href: "/settings/estimate-statuses", label: "Statuses" }] },
  { label: "Modules", href: "/settings/modules" },
  { label: "E-mail templates", href: "/settings/email-templates" },
  { label: "Custom fields", href: "/settings/custom-fields" },
  { label: "GDPR", href: "/settings/gdpr" },
  { label: "Menu setup", href: "/settings/menu" },
  { label: "Theme style", href: "/settings/theme" },
  { label: "Settings", href: "/settings" },
  { label: "Help", href: "/settings/help" },
];

export function SettingsNav() {
  const pathname = usePathname();
  const link = (href: string, label: string, child = false) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={cn(
        "block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
        child && "lg:ml-3 lg:text-[13px]",
        pathname === href ? "bg-white text-brand-700 shadow-card ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60",
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Setup">
      {ITEMS.map((i) =>
        i.children ? (
          <div key={i.label} className="flex gap-1 lg:flex-col">
            <span className="hidden px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block">{i.label}</span>
            {i.children.map((c) => link(c.href, c.label, true))}
          </div>
        ) : (
          link(i.href!, i.label)
        ),
      )}
    </nav>
  );
}
