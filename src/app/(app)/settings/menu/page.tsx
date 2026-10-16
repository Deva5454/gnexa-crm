import type { Metadata } from "next";
import { arrange, NAV } from "@/components/layout/nav";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { MenuEditor, type MenuGroup } from "./menu-editor";

export const metadata: Metadata = { title: "Menu setup" };

export default async function MenuSetupPage() {
  const { settings } = await requireAdmin();
  const all = { ...settings.menu, hidden: [] };
  // Every list the menu has (sections, plus the Utilities and Reports submenus), in the saved order
  const groups: MenuGroup[] = [];
  for (const s of NAV) {
    groups.push({ key: s.section, label: s.section, items: arrange(s.items, s.section, all).map((i) => ({ href: i.href, label: i.label })) });
    for (const i of s.items)
      if (i.children) groups.push({ key: i.href, label: `${i.label} submenu`, items: arrange(i.children, i.href, all).map((c) => ({ href: c.href, label: c.label })) });
  }
  return (
    <Card>
      <CardHeader title="Menu setup" description="Reorder the sidebar and hide items your team doesn't need. Hiding only tidies the menu — use Modules or Roles to close a feature." />
      <MenuEditor groups={groups} hidden={settings.menu.hidden ?? []} />
    </Card>
  );
}
