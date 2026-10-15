import { AppShell } from "@/components/layout/app-shell";
import { requireStaff } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return (
    <AppShell name={profile.full_name || profile.email} email={profile.email} isAdmin={profile.is_admin}>
      {children}
    </AppShell>
  );
}
