import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Help" };

const TOPICS: { title: string; body: React.ReactNode }[] = [
  { title: "Adding your team", body: <>Create each person in Supabase → Authentication → Users. They appear under <Link href="/settings/staff" className="text-brand-700 underline">Staff</Link> as inactive — tick Active and pick a role.</> },
  { title: "What each role can do", body: <>Set view / create & edit / full access per module under <Link href="/settings/roles" className="text-brand-700 underline">Roles</Link>. The database enforces these too, not just the screens.</> },
  { title: "GST on invoices", body: <>Put your GSTIN in <Link href="/settings" className="text-brand-700 underline">Settings</Link>. Customers in your state get CGST + SGST, others IGST, from their GSTIN or state. Add HSN / SAC codes to <Link href="/sales/items" className="text-brand-700 underline">Items</Link>.</> },
  { title: "Other currencies", body: <>Add currencies and rates under <Link href="/settings/currencies" className="text-brand-700 underline">Currencies</Link>. Each document keeps the rate of the day it was raised; totals and reports convert to your base currency.</> },
  { title: "Recurring invoices and reminders", body: <>They run on their own every 15 minutes. Overdue reminders are set under <Link href="/settings/finance" className="text-brand-700 underline">Finance</Link>; e-mails are simulated and listed in the E-mail log.</> },
  { title: "Collecting leads and quote requests", body: <>Create a form under <Link href="/settings/web-forms" className="text-brand-700 underline">Estimate request → Forms</Link> and share its link. Request stages live under <Link href="/settings/estimate-statuses" className="text-brand-700 underline">Statuses</Link>.</> },
  { title: "Tidying the menu", body: <>Switch off unused features in <Link href="/settings/modules" className="text-brand-700 underline">Modules</Link>, reorder or hide items in <Link href="/settings/menu" className="text-brand-700 underline">Menu setup</Link>, and pick a brand colour in <Link href="/settings/theme" className="text-brand-700 underline">Theme style</Link>.</> },
  { title: "Backups and exports", body: <>Download everything as one file from <Link href="/backup" className="text-brand-700 underline">Database backup</Link>, or one list at a time from <Link href="/csv-export" className="text-brand-700 underline">CSV export</Link>. Supabase also keeps its own daily backups.</> },
  { title: "Going live", body: <>While this is a demo, follow the steps on the <Link href="/settings" className="text-brand-700 underline">Settings</Link> page to switch it into your own CRM.</> },
];

export default async function HelpPage() {
  await requireAdmin();
  return (
    <Card>
      <CardHeader title="Help" description="Quick answers for running Gnexa CRM." />
      <CardBody className="divide-y divide-slate-100 p-0">
        {TOPICS.map((t) => (
          <details key={t.title} className="group px-5 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 marker:hidden">
              <span className="mr-2 inline-block text-slate-400 transition group-open:rotate-90">›</span>
              {t.title}
            </summary>
            <p className="mt-2 pl-4 text-sm leading-relaxed text-slate-600">{t.body}</p>
          </details>
        ))}
      </CardBody>
    </Card>
  );
}
