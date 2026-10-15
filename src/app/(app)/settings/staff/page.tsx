import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { updateStaff } from "../actions";
import { NamedList } from "../named-list";
import { RoleMatrix } from "./role-matrix";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { supabase, profile: me } = await requireAdmin();
  const [{ data: staff }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("is_active").order("full_name"),
    supabase.from("roles").select("id, name, permissions").order("name"),
  ]);
  const pending = staff?.filter((s) => !s.is_active).length ?? 0;

  return (
    <>
      <Card>
        <CardHeader
          title="Team members"
          description="New sign-ups appear here inactive. Tick Active to let them in."
          action={pending ? <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{pending} awaiting approval</Badge> : undefined}
        />
        <ul className="divide-y divide-slate-100">
          {staff?.map((s) => {
            const self = s.id === me.id;
            return (
              <li key={s.id}>
                <form action={updateStaff} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                  <input type="hidden" name="id" value={s.id} />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={s.full_name} className="h-9 w-9" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="truncate">{s.full_name}</span>
                        {self && <Badge>You</Badge>}
                        {!s.is_active && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Pending</Badge>}
                      </div>
                      <div className="truncate text-xs text-slate-500">{s.email} · joined {formatDate(s.created_at)}</div>
                    </div>
                  </div>
                  <select name="role_id" defaultValue={s.role_id ?? ""} className="field md:w-44" aria-label="Role">
                    <option value="">No role</option>
                    {roles?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="is_active" defaultChecked={s.is_active} disabled={self} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="is_admin" defaultChecked={s.is_admin} disabled={self} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Admin
                  </label>
                  <SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      </Card>
      <RoleMatrix roles={roles ?? []} />
      <NamedList table="roles" title="Roles" description="Add or remove roles. New roles start with create & edit access." items={roles ?? []} />
    </>
  );
}
