import type { Metadata } from "next";
import { allTags, idsWithTag, tagsFor } from "@/components/crm/tags";
import { TagChip } from "@/components/crm/tag-editor";
import { TagFilter } from "@/components/crm/tag-filter";
import { BulkBar, SelectAll } from "@/components/crm/bulk-bar";
import Link from "next/link";
import { ArrowDown, ArrowUp, Building2, Contact, Download, Plus, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ParamSelect } from "@/components/ui/param-select";
import { SearchInput } from "@/components/ui/search-input";
import { requireStaff } from "@/lib/auth";
import { todayIST } from "@/lib/dates";
import { allRows } from "@/lib/fetch-all";
import { balancesFor } from "@/lib/sales-data";
import { cn, formatDate, searchTerm } from "@/lib/utils";
import { bulkCustomers, toggleCustomerActive } from "./actions";

export const metadata: Metadata = { title: "Customers" };

type SP = { q?: string; group?: string; status?: string; page?: string; tag?: string; country?: string; admin?: string; has?: string; sort?: string; dir?: string };

const PAGE_SIZE = 25;
const BULK_FORM = "bulk-customers";
const SORTS: Record<string, string> = { id: "id", company: "company", created: "created_at" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can, profile } = await requireStaff();
  const canEdit = can("customers", "edit");
  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : "company";
  const asc = sortKey === "company" ? sp.dir !== "desc" : sp.dir === "asc";

  // "Has …" filters (Perfex: customers with unpaid / overdue invoices, open projects, open tickets)
  let only: number[] | null = null;
  const keep = (ids: Iterable<number>) => {
    const set = new Set(ids);
    only = only ? only.filter((i) => set.has(i)) : [...set];
  };
  if ((sp.has === "unpaid" || sp.has === "overdue") && can("sales", "view")) {
    const { data: invs } = await allRows((a, b) => supabase.from("sales_docs").select("id, customer_id, due_date").eq("kind", "invoice").in("status", ["sent", "accepted"]).not("customer_id", "is", null).order("id").range(a, b));
    const bals = await balancesFor(supabase, invs.map((i) => i.id));
    const today = todayIST();
    keep(invs.filter((i) => (bals.get(i.id)?.balance ?? 1) > 0.005 && (sp.has === "unpaid" || (i.due_date && i.due_date < today))).map((i) => i.customer_id!));
  }
  if (sp.has === "projects" && can("projects", "view")) {
    const { data } = await supabase.from("projects").select("customer_id").not("status", "in", "(finished,cancelled)");
    keep((data ?? []).map((p) => p.customer_id));
  }
  if (sp.has === "tickets" && can("support", "view")) {
    const { data } = await supabase.from("tickets").select("customer_id").neq("status", "closed").not("customer_id", "is", null);
    keep((data ?? []).map((t) => t.customer_id!));
  }
  const adminId = sp.admin === "me" ? profile.id : sp.admin && /^[0-9a-f-]{36}$/i.test(sp.admin) ? sp.admin : null;
  if (adminId) {
    const { data } = await supabase.from("customer_admins").select("customer_id").eq("staff_id", adminId);
    keep((data ?? []).map((r) => r.customer_id));
  }
  if (Number(sp.tag)) keep(await idsWithTag(supabase, "customer", Number(sp.tag)));

  let query = supabase
    .from("customers")
    .select("id, company, phone, city, country, is_active, created_at, group:customer_groups(name), contacts(first_name, last_name, email, is_primary), customer_admins(staff:profiles(full_name))", { count: "exact" })
    .order(SORTS[sortKey]!, { ascending: asc })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) query = query.or(`company.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%,vat.ilike.%${term}%`);
  if (Number(sp.group)) query = query.eq("group_id", Number(sp.group));
  if (sp.group === "none") query = query.is("group_id", null);
  if (sp.status === "active") query = query.eq("is_active", true);
  if (sp.status === "inactive") query = query.eq("is_active", false);
  if (sp.country) query = query.eq("country", sp.country);
  const ids = only as number[] | null;
  if (ids) query = query.in("id", ids.length ? ids.slice(0, 1000) : [0]);

  const [{ data: rows, count }, { data: groups }, total, active, contacts, portal, { data: countries }, { data: staff }, tagList] = await Promise.all([
    query,
    supabase.from("customer_groups").select("id, name").order("name"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("portal_users").select("user_id", { count: "exact", head: true }),
    supabase.from("customers").select("country").not("country", "is", null).order("country").limit(2000),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
    allTags(supabase),
  ]);
  const tagMap = await tagsFor(supabase, "customer", (rows ?? []).map((c) => c.id));
  const countryList = [...new Set((countries ?? []).map((c) => c.country!).filter(Boolean))];

  const stats = [
    { label: "Total customers", value: total.count ?? 0, tone: "text-slate-900", href: "/customers" },
    { label: "Active", value: active.count ?? 0, tone: "text-emerald-600", href: "/customers?status=active" },
    { label: "Inactive", value: (total.count ?? 0) - (active.count ?? 0), tone: "text-slate-400", href: "/customers?status=inactive" },
    { label: "Contacts", value: contacts.count ?? 0, tone: "text-brand-600", href: "/customers/contacts" },
    { label: "Portal logins", value: portal.count ?? 0, tone: "text-sky-600", href: "/customers/contacts?portal=1" },
  ];

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, page: undefined, ...patch })) if (v) next.set(k, v);
    const qs = next.toString();
    return qs ? `/customers?${qs}` : "/customers";
  };
  const sortHead = (key: string, label: string, className?: string) => {
    const on = sortKey === key;
    const Icon = on && asc ? ArrowUp : ArrowDown;
    const defaultAsc = key === "company";
    return (
      <th className={className} aria-sort={on ? (asc ? "ascending" : "descending") : "none"}>
        <Link href={href({ sort: key === "company" ? undefined : key, dir: on ? (asc ? "desc" : "asc") : defaultAsc ? undefined : "desc" })} className={cn("inline-flex items-center gap-1 hover:text-slate-900", on && "text-slate-900")}>
          {label}
          <Icon className={cn("h-3 w-3", on ? "opacity-100" : "opacity-0")} aria-hidden />
        </Link>
      </th>
    );
  };
  const groupOpts = (groups ?? []).map((g) => ({ value: String(g.id), label: g.name }));
  const staffOpts = (staff ?? []).map((s) => ({ value: s.id, label: s.full_name }));
  const filtered = !!(term || sp.group || sp.status || sp.country || sp.admin || sp.has || sp.tag);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Companies you sell to, with their people and history."
        actions={
          <>
            <LinkButton href="/customers/contacts" variant="secondary">
              <Contact className="h-4 w-4" /> Contacts
            </LinkButton>
            <LinkButton href="/csv-export/customers" variant="secondary">
              <Download className="h-4 w-4" /> Export
            </LinkButton>
            {canEdit && (
              <LinkButton href="/customers/import" variant="secondary">
                <Upload className="h-4 w-4" /> Import
              </LinkButton>
            )}
            {canEdit && (
              <LinkButton href="/customers/new">
                <Plus className="h-4 w-4" /> New customer
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="px-5 py-4 transition hover:border-brand-200">
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className={cn("mt-1 text-2xl font-bold", s.tone)}>{s.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <ParamSelect name="status" label="Status" allLabel="Active & inactive" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            <ParamSelect name="group" label="Group" allLabel="All groups" options={[...groupOpts, { value: "none", label: "No group" }]} />
            {countryList.length > 0 && <ParamSelect name="country" label="Country" allLabel="All countries" options={countryList.map((c) => ({ value: c, label: c }))} />}
            <ParamSelect name="admin" label="Customer admin" allLabel="Any admin" options={[{ value: "me", label: "My customers" }, ...staffOpts]} />
            <ParamSelect
              name="has"
              label="Customers with"
              allLabel="With anything"
              options={[
                ...(can("sales", "view") ? [{ value: "unpaid", label: "With unpaid invoices" }, { value: "overdue", label: "With overdue invoices" }] : []),
                ...(can("projects", "view") ? [{ value: "projects", label: "With open projects" }] : []),
                ...(can("support", "view") ? [{ value: "tickets", label: "With open tickets" }] : []),
              ]}
            />
            {tagList.length > 0 && <TagFilter tags={tagList} />}
          </div>
          <SearchInput placeholder="Search company, phone, city, GSTIN…" />
        </div>

        {canEdit && (
          <BulkBar
            id={BULK_FORM}
            action={bulkCustomers}
            noun="customer"
            ops={[
              { value: "group", label: "Change group", target: { label: "New group", options: [{ value: "none", label: "— No group —" }, ...groupOpts] } },
              { value: "admin", label: "Assign customer admin", target: { label: "Staff", options: staffOpts } },
              ...(tagList.length ? [{ value: "tag", label: "Add tag", target: { label: "Tag", options: tagList.map((t) => ({ value: String(t.id), label: t.name })) } }] : []),
              { value: "active", label: "Mark active" },
              { value: "inactive", label: "Mark inactive" },
              ...(can("customers", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
            ]}
          />
        )}

        {!rows?.length ? (
          <EmptyState
            icon={Building2}
            title={filtered ? "No customers match" : "No customers yet"}
            description={filtered ? "Try other filters or a different search." : "Add your first customer or convert a lead."}
            action={!filtered && canEdit && <LinkButton href="/customers/new"><Plus className="h-4 w-4" /> New customer</LinkButton>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    {canEdit && <th className="w-8"><SelectAll form={BULK_FORM} label="Select all customers on this page" /></th>}
                    {sortHead("id", "#", "w-12")}
                    {sortHead("company", "Company")}
                    <th>Primary contact</th>
                    <th className="hidden md:table-cell">Phone</th>
                    <th className="hidden lg:table-cell">Group</th>
                    <th className="hidden xl:table-cell">Admins</th>
                    <th>Active</th>
                    {sortHead("created", "Created", "hidden xl:table-cell")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const primary = c.contacts.find((x) => x.is_primary) ?? c.contacts[0];
                    const admins = (c.customer_admins ?? []).map((a) => a.staff?.full_name).filter(Boolean) as string[];
                    return (
                      <tr key={c.id}>
                        {canEdit && (
                          <td>
                            <input type="checkbox" name="ids" value={c.id} form={BULK_FORM} aria-label={`Select ${c.company}`} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          </td>
                        )}
                        <td className="text-xs text-slate-400">{c.id}</td>
                        <td>
                          <Link href={`/customers/${c.id}`} className="flex items-center gap-3 font-semibold text-slate-900 hover:text-brand-700">
                            <Avatar name={c.company} className="rounded-lg" />
                            <span>
                              {c.company}
                              {(tagMap.get(c.id) ?? []).length > 0 && (
                                <span className="mt-0.5 flex flex-wrap gap-1">{tagMap.get(c.id)!.map((g) => <TagChip key={g.id} tag={g} className="px-1.5 text-[10px]" />)}</span>
                              )}
                              {(c.city || c.country) && <span className="block text-xs font-normal text-slate-400">{[c.city, c.country].filter(Boolean).join(", ")}</span>}
                            </span>
                          </Link>
                        </td>
                        <td>
                          {primary ? (
                            <div>
                              <div className="text-slate-700">{[primary.first_name, primary.last_name].filter(Boolean).join(" ")}</div>
                              {primary.email && <a href={`mailto:${primary.email}`} className="text-xs text-slate-400 hover:text-brand-700">{primary.email}</a>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="hidden text-slate-600 md:table-cell">{c.phone ?? "—"}</td>
                        <td className="hidden lg:table-cell">{c.group ? <Badge>{c.group.name}</Badge> : <span className="text-slate-400">—</span>}</td>
                        <td className="hidden xl:table-cell">
                          {admins.length ? (
                            <span className="flex -space-x-1.5" title={admins.join(", ")}>
                              {admins.slice(0, 3).map((n) => <Avatar key={n} name={n} className="h-6 w-6 text-[10px] ring-2 ring-white" />)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <form action={toggleCustomerActive}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="active" value={c.is_active ? "0" : "1"} />
                              <button
                                role="switch"
                                aria-checked={c.is_active}
                                aria-label={`${c.company} active`}
                                className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition", c.is_active ? "bg-emerald-500" : "bg-slate-300")}
                              >
                                <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition", c.is_active ? "translate-x-4" : "translate-x-0.5")} />
                              </button>
                            </form>
                          ) : (
                            <Badge className={c.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}>{c.is_active ? "Active" : "Inactive"}</Badge>
                          )}
                        </td>
                        <td className="hidden text-slate-500 xl:table-cell">{formatDate(c.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/customers" params={{ ...sp, page: undefined }} />
          </>
        )}
      </Card>
    </>
  );
}
