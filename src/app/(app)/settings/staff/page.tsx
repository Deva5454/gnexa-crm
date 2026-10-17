import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { cn, formatDate, searchTerm } from "@/lib/utils";
import { approveStaff } from "../actions";

export const metadata: Metadata = { title: "Staff" };

type SP = { q?: string; show?: string };

/** Perfex Setup → Staff: everyone on the team; open a person to edit them, see their workload and keep notes. */
export default async function StaffPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, profile: me } = await requireAdmin();
  const term = sp.q ? searchTerm(sp.q).toLowerCase() : "";
  const [{ data: staff }, { data: roles }, { data: depts }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, job_title, phone, is_active, is_admin, role_id, created_at").order("is_active").order("full_name"),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("ticket_departments").select("id, name").order("name"),
    supabase.from("staff_departments").select("staff_id, department_id"),
  ]);
  const all = staff ?? [];
  const pending = all.filter((s) => !s.is_active).length;
  const rows = all
    .filter((s) => (sp.show === "pending" ? !s.is_active : sp.show === "admins" ? s.is_admin : sp.show === "active" ? s.is_active : true))
    .filter((s) => !term || [s.full_name, s.email, s.job_title ?? ""].some((v) => v.toLowerCase().includes(term)));
  const pill = (on: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", on ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const link = (show?: string) => `/settings/staff${show || sp.q ? `?${new URLSearchParams({ ...(show ? { show } : {}), ...(sp.q ? { q: sp.q } : {}) })}` : ""}`;

  return (
    <Card>
      <CardHeader
        title="Team members"
        description="New sign-ups appear here inactive — approve them to let them in. Open a person to change their role, departments and details, see their workload and keep notes."
        action={pending ? <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{pending} awaiting approval</Badge> : undefined}
      />
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <Link href={link()} className={pill(!sp.show)}>All <span className="opacity-60">{all.length}</span></Link>
          <Link href={link("active")} className={pill(sp.show === "active")}>Active <span className="opacity-60">{all.length - pending}</span></Link>
          <Link href={link("pending")} className={pill(sp.show === "pending")}>Pending <span className="opacity-60">{pending}</span></Link>
          <Link href={link("admins")} className={pill(sp.show === "admins")}>Administrators <span className="opacity-60">{all.filter((s) => s.is_admin).length}</span></Link>
        </div>
        <SearchInput placeholder="Search name, e-mail or job title…" />
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Staff member</th>
              <th className="hidden md:table-cell">Role</th>
              <th className="hidden lg:table-cell">Departments</th>
              <th className="hidden sm:table-cell">Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const theirDepts = (memberships ?? []).filter((m) => m.staff_id === s.id).map((m) => depts?.find((d) => d.id === m.department_id)?.name).filter(Boolean);
              return (
                <tr key={s.id}>
                  <td>
                    <Link href={`/settings/staff/${s.id}`} className="flex items-center gap-3">
                      <Avatar name={s.full_name} className="h-8 w-8 shrink-0" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold text-slate-900 hover:text-brand-700">
                          <span className="truncate">{s.full_name}</span>
                          {s.id === me.id && <Badge>You</Badge>}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{s.job_title ? `${s.job_title} · ` : ""}{s.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden text-slate-600 md:table-cell">{s.is_admin ? "Administrator" : (roles?.find((r) => r.id === s.role_id)?.name ?? <span className="text-slate-400">No role</span>)}</td>
                  <td className="hidden text-xs text-slate-500 lg:table-cell">{theirDepts.length ? theirDepts.join(", ") : "—"}</td>
                  <td className="hidden whitespace-nowrap text-slate-500 sm:table-cell">{formatDate(s.created_at)}</td>
                  <td>
                    {s.is_active ? (
                      <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Active</Badge>
                    ) : (
                      <form action={approveStaff} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Pending</Badge>
                        <SubmitButton size="sm" variant="secondary" pendingText="…">Approve</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-slate-400">Nobody matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
