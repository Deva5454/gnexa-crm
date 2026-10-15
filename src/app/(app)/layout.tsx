import { AppShell } from "@/components/layout/app-shell";
import { requireStaff } from "@/lib/auth";
import { personaByEmail } from "@/lib/demo";
import { MODULES } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, roleName, can } = await requireStaff();
  return (
    <AppShell
      name={profile.full_name || profile.email}
      roleName={roleName}
      personaKey={personaByEmail(profile.email)?.key}
      isAdmin={profile.is_admin}
      canCreate={{ customers: can("customers", "edit"), leads: can("leads", "edit"), tasks: can("tasks", "edit"), sales: can("sales", "edit"), expenses: can("expenses", "edit"), projects: can("projects", "edit"), support: can("support", "edit") }}
      visible={MODULES.filter((m) => can(m, "view"))}
    >
      {children}
    </AppShell>
  );
}
