import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { cn, formatDate, PAGE_SIZE, searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

type SP = { q?: string; group?: string; status?: string; page?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  const canEdit = can("customers", "edit");

  let query = supabase
    .from("customers")
    .select("id, company, phone, city, country, is_active, created_at, group:customer_groups(name), contacts(first_name, last_name, email, is_primary)", {
      count: "exact",
    })
    .order("company")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) query = query.or(`company.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%`);
  if (sp.group) query = query.eq("group_id", Number(sp.group));
  if (sp.status === "active") query = query.eq("is_active", true);
  if (sp.status === "inactive") query = query.eq("is_active", false);

  const [{ data: rows, count }, { data: groups }, total, active, contacts] = await Promise.all([
    query,
    supabase.from("customer_groups").select("id, name").order("name"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Total customers", value: total.count ?? 0, tone: "text-slate-900" },
    { label: "Active", value: active.count ?? 0, tone: "text-emerald-600" },
    { label: "Inactive", value: (total.count ?? 0) - (active.count ?? 0), tone: "text-slate-400" },
    { label: "Contacts", value: contacts.count ?? 0, tone: "text-brand-600" },
  ];

  const filterHref = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    const merged = { ...sp, ...patch, page: undefined };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/customers?${qs}` : "/customers";
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description="Companies you sell to, with their people and history."
        actions={
          canEdit && (
            <LinkButton href="/customers/new">
              <Plus className="h-4 w-4" /> New customer
            </LinkButton>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="px-5 py-4">
            <div className="text-xs font-medium text-slate-500">{s.label}</div>
            <div className={cn("mt-1 text-2xl font-bold", s.tone)}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: undefined, label: "All" },
              { key: "active", label: "Active" },
              { key: "inactive", label: "Inactive" },
            ].map((f) => (
              <Link
                key={f.label}
                href={filterHref({ status: f.key })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  sp.status === f.key ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {f.label}
              </Link>
            ))}
            <span className="mx-1 w-px bg-slate-200" />
            {groups?.map((g) => (
              <Link
                key={g.id}
                href={filterHref({ group: sp.group === String(g.id) ? undefined : String(g.id) })}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  sp.group === String(g.id) ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                )}
              >
                {g.name}
              </Link>
            ))}
          </div>
          <SearchInput placeholder="Search company, phone, city…" />
        </div>

        {!rows?.length ? (
          <EmptyState
            icon={Building2}
            title={term || sp.group || sp.status ? "No customers match" : "No customers yet"}
            description={term ? "Try a different search." : "Add your first customer or convert a lead."}
            action={!term && canEdit && <LinkButton href="/customers/new"><Plus className="h-4 w-4" /> New customer</LinkButton>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Primary contact</th>
                    <th className="hidden md:table-cell">Phone</th>
                    <th className="hidden lg:table-cell">Location</th>
                    <th className="hidden md:table-cell">Group</th>
                    <th>Status</th>
                    <th className="hidden xl:table-cell">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const primary = c.contacts.find((x) => x.is_primary) ?? c.contacts[0];
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/customers/${c.id}`} className="flex items-center gap-3 font-semibold text-slate-900 hover:text-brand-700">
                            <Avatar name={c.company} className="rounded-lg" />
                            {c.company}
                          </Link>
                        </td>
                        <td>
                          {primary ? (
                            <div>
                              <div className="text-slate-700">{[primary.first_name, primary.last_name].filter(Boolean).join(" ")}</div>
                              {primary.email && <div className="text-xs text-slate-400">{primary.email}</div>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="hidden text-slate-600 md:table-cell">{c.phone ?? "—"}</td>
                        <td className="hidden text-slate-600 lg:table-cell">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                        <td className="hidden md:table-cell">{c.group ? <Badge>{c.group.name}</Badge> : <span className="text-slate-400">—</span>}</td>
                        <td>
                          <Badge className={c.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}>
                            {c.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="hidden text-slate-500 xl:table-cell">{formatDate(c.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/customers" params={{ q: sp.q, group: sp.group, status: sp.status }} />
          </>
        )}
      </Card>
    </>
  );
}
