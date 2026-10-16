import type { Metadata } from "next";
import { FEATURES } from "@/components/layout/nav";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { MODULES } from "@/lib/permissions";
import { saveModules } from "../actions";

export const metadata: Metadata = { title: "Modules" };

const LABEL: Record<string, string> = {
  customers: "Customers", leads: "Leads", tasks: "Tasks", sales: "Sales (proposals, estimates, invoices, payments)", expenses: "Expenses",
  projects: "Projects & timesheets", contracts: "Contracts", support: "Support tickets", knowledge_base: "Knowledge base", reports: "Reports & goals",
  newsfeed: "Newsfeed", todos: "To-do lists", estimate_requests: "Estimate requests", subscriptions: "Subscriptions", surveys: "Surveys",
  media: "Media library", calendar: "Calendar", goals: "Goals", announcements: "Announcements",
};

export default async function ModulesPage() {
  const { settings } = await requireAdmin();
  const off = new Set(settings.disabled);
  const row = (key: string) => (
    <label key={key} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
      <span className="font-medium text-slate-700">{LABEL[key] ?? key}</span>
      <input type="checkbox" name={`on_${key}`} defaultChecked={!off.has(key)} className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-slate-200 transition before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-brand-600 checked:before:translate-x-[18px]" />
    </label>
  );
  return (
    <form action={saveModules} className="space-y-6">
      <Card>
        <CardHeader title="Core modules" description="Switch off what your business doesn't use — it disappears from the menu and its pages close for everyone, admins included." />
        <div className="divide-y divide-slate-100">{MODULES.map(row)}</div>
      </Card>
      <Card>
        <CardHeader title="Extras" />
        <div className="divide-y divide-slate-100">{FEATURES.map(row)}</div>
        <CardBody className="border-t border-slate-100">
          <SubmitButton pendingText="Saving…">Save modules</SubmitButton>
        </CardBody>
      </Card>
    </form>
  );
}
