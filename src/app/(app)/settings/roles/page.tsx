import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { NamedList } from "../named-list";
import { RoleMatrix } from "../staff/role-matrix";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const { supabase } = await requireAdmin();
  const { data: roles } = await supabase.from("roles").select("id, name, permissions").order("name");
  return (
    <>
      <RoleMatrix roles={roles ?? []} />
      <NamedList table="roles" title="Roles" description="Add or remove roles. New roles start with create & edit access." items={roles ?? []} />
    </>
  );
}
