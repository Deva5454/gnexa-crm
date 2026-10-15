"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building, Magnet, UsersRound, Boxes, Landmark, LifeBuoy, Tags, ListPlus, MailOpen, Coins, FormInput, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/settings", label: "General", icon: Building },
  { href: "/settings/staff", label: "Staff & roles", icon: UsersRound },
  { href: "/settings/leads", label: "Lead pipeline", icon: Magnet },
  { href: "/settings/customers", label: "Customer groups", icon: Boxes },
  { href: "/settings/finance", label: "Finance", icon: Landmark },
  { href: "/settings/delivery", label: "Contracts & support", icon: LifeBuoy },
  { href: "/settings/tags", label: "Tags", icon: Tags },
  { href: "/settings/custom-fields", label: "Custom fields", icon: ListPlus },
  { href: "/settings/email-templates", label: "E-mail templates", icon: MailOpen },
  { href: "/settings/currencies", label: "Currencies", icon: Coins },
  { href: "/settings/web-forms", label: "Web forms", icon: FormInput },
  { href: "/settings/gdpr", label: "Privacy (GDPR)", icon: ShieldCheck },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
            pathname === i.href ? "bg-white text-brand-700 shadow-card ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60",
          )}
        >
          <i.icon className="h-4 w-4" /> {i.label}
        </Link>
      ))}
    </nav>
  );
}
