import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Json } from "@/lib/database.types";
import { LEVEL_LABEL, MODULES } from "@/lib/permissions";
import { saveRolePermissions } from "../actions";

const NAMES: Record<string, string> = {
  customers: "Customers", leads: "Leads", tasks: "Tasks", sales: "Sales", expenses: "Expenses",
  projects: "Projects", contracts: "Contracts", support: "Support", knowledge_base: "Knowledge base", reports: "Reports & goals",
};

/** Per-role access levels for every module. Administrators always have full access. */
export function RoleMatrix({ roles }: { roles: { id: number; name: string; permissions: Json }[] }) {
  return (
    <Card>
      <CardHeader title="Role permissions" description="What each role can do in every module. Changes apply on the next page load." />
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Module</th>
              {roles.map((r) => <th key={r.id} className="min-w-[150px]">{r.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m}>
                <td className="font-medium text-slate-700">{NAMES[m] ?? m}</td>
                {roles.map((r) => {
                  const p = (r.permissions && typeof r.permissions === "object" && !Array.isArray(r.permissions) ? r.permissions : {}) as Record<string, Json>;
                  const v = typeof p[m] === "string" ? (p[m] as string) : "edit";
                  return (
                    <td key={r.id}>
                      <select name={m} form={`role-${r.id}`} defaultValue={v} className="field h-8 py-1 text-xs" aria-label={`${r.name}: ${NAMES[m]}`}>
                        {(["none", "view", "edit", "full"] as const).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {roles.map((r) => (
                <td key={r.id}>
                  <form id={`role-${r.id}`} action={saveRolePermissions}>
                    <input type="hidden" name="role_id" value={r.id} />
                    <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save {r.name}</SubmitButton>
                  </form>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
