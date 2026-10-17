"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/portal", label: "Home" },
  { href: "/portal/invoices", label: "Invoices" },
  { href: "/portal/subscriptions", label: "Subscriptions" },
  { href: "/portal/quotes", label: "Quotes" },
  { href: "/portal/contracts", label: "Contracts" },
  { href: "/portal/projects", label: "Projects" },
  { href: "/portal/tickets", label: "Support" },
  { href: "/portal/help", label: "Help center" },
  { href: "/portal/privacy", label: "Privacy" },
];

/** `hidden`: links for modules switched off in Setup → Modules. */
export function PortalNav({ hidden = [] }: { hidden?: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto">
      {LINKS.filter((l) => !hidden.includes(l.href)).map((l) => {
        const active = l.href === "/portal" ? pathname === "/portal" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active ? "border-accent-400 text-white" : "border-transparent text-slate-400 hover:text-white",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
