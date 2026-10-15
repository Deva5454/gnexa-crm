import { AppShell } from "@/components/layout/app-shell";
import { requireStaff } from "@/lib/auth";
import { personaByEmail } from "@/lib/demo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, roleName, can } = await requireStaff();
  return (
    <AppShell
      name={profile.full_name || profile.email}
      roleName={roleName}
      personaKey={personaByEmail(profile.email)?.key}
      isAdmin={profile.is_admin}
      canCreate={{ customers: can("customers", "edit"), leads: can("leads", "edit"), tasks: can("tasks", "edit") }}
    >
      {children}
    </AppShell>
  );
}
