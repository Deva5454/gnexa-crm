import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { Flash } from "@/components/layout/flash";
import { requireStaff } from "@/lib/auth";
import { personaByEmail } from "@/lib/demo";
import { FLASH_COOKIE } from "@/lib/flash";
import { MODULES } from "@/lib/permissions";

function readFlash(raw: string | undefined) {
  try {
    const f = raw ? JSON.parse(raw) : null;
    return f && typeof f.message === "string" ? { id: Number(f.id) || 0, message: f.message as string } : null;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, roleName, can } = await requireStaff();
  const flash = readFlash((await cookies()).get(FLASH_COOKIE)?.value);
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
      <Flash flash={flash} />
    </AppShell>
  );
}
