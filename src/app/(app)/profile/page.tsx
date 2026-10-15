import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { allows, type Level, type Module } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ProfileForm } from "./forms";

export const metadata: Metadata = { title: "My profile" };

const MODULES: { key: Module; label: string }[] = [
  { key: "customers", label: "Customers & contacts" },
  { key: "leads", label: "Leads" },
  { key: "tasks", label: "Tasks" },
  { key: "sales", label: "Sales (proposals, estimates, invoices, payments)" },
  { key: "expenses", label: "Expenses" },
];
const LEVELS: { key: Level; label: string }[] = [
  { key: "view", label: "View" },
  { key: "edit", label: "Create & edit" },
  { key: "full", label: "Delete" },
];

export default async function ProfilePage() {
  const { profile, roleName, access } = await requireStaff();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My profile" description={`Signed in as the ${roleName} demo persona`} />
      <Card>
        <CardHeader title="What this role can do" description={profile.is_admin ? "Administrators can also open Setup." : "Setup is admin-only."} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Module</th>
                {LEVELS.map((l) => <th key={l.key} className="text-center">{l.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.key}>
                  <td className="font-medium text-slate-700">{m.label}</td>
                  {LEVELS.map((l) => {
                    const ok = allows(access, m.key, l.key);
                    return (
                      <td key={l.key} className="text-center">
                        <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-300")}>
                          {ok ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ProfileForm fullName={profile.full_name} phone={profile.phone ?? ""} jobTitle={profile.job_title ?? ""} email={profile.email} />
    </div>
  );
}
