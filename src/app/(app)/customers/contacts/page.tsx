import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, KeyRound, Star, Users } from "lucide-react";
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
import { formatDate, searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

type SP = { q?: string; page?: string; portal?: string; primary?: string; consent?: string };
const PAGE_SIZE = 25;

/** Perfex "Contacts": every customer contact in one list. */
export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { supabase, can } = await requireStaff();
  if (!can("customers", "view")) notFound();

  const { data: portalRows } = await supabase.from("portal_users").select("contact_id").not("contact_id", "is", null);
  const portalIds = (portalRows ?? []).map((p) => p.contact_id!);

  let q = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, title, is_primary, marketing_consent, created_at, customer:customers(id, company, is_active)", { count: "exact" })
    .order("first_name")
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  if (sp.portal === "1") q = q.in("id", portalIds.length ? portalIds : [0]);
  if (sp.primary === "1") q = q.eq("is_primary", true);
  if (sp.consent === "1") q = q.eq("marketing_consent", true);
  if (sp.consent === "0") q = q.eq("marketing_consent", false);
  const { data: rows, count } = await q;
  const hasPortal = new Set(portalIds);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/customers" className="hover:text-brand-600">Customers</Link>}
        title="Contacts"
        description={`${count ?? 0} people across your customers`}
        actions={
          <LinkButton href="/csv-export/contacts" variant="secondary">
            <Download className="h-4 w-4" /> Export
          </LinkButton>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <ParamSelect name="primary" label="Primary contacts" allLabel="All contacts" options={[{ value: "1", label: "Primary contacts only" }]} />
            <ParamSelect name="portal" label="Portal access" allLabel="Any portal access" options={[{ value: "1", label: "With portal login" }]} />
            <ParamSelect name="consent" label="Marketing consent" allLabel="Any consent" options={[{ value: "1", label: "Consented to marketing" }, { value: "0", label: "No marketing consent" }]} />
          </div>
          <SearchInput placeholder="Search name, e-mail, phone…" />
        </div>
        {!rows?.length ? (
          <EmptyState icon={Users} title="No contacts match" description="Try other filters or a different search." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Company</th>
                    <th className="hidden md:table-cell">E-mail</th>
                    <th className="hidden md:table-cell">Phone</th>
                    <th className="hidden lg:table-cell">Position</th>
                    <th className="hidden lg:table-cell">Access</th>
                    <th className="hidden xl:table-cell">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="flex items-center gap-2 font-medium text-slate-900">
                            <Avatar name={name} className="h-7 w-7 text-[10px]" />
                            {name}
                            {p.is_primary && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Primary contact" />}
                          </span>
                        </td>
                        <td>
                          {p.customer ? (
                            <Link href={`/customers/${p.customer.id}?tab=contacts`} className="text-slate-700 hover:text-brand-700">
                              {p.customer.company}
                              {!p.customer.is_active && <span className="ml-1 text-xs text-slate-400">(inactive)</span>}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="hidden md:table-cell">{p.email ? <a href={`mailto:${p.email}`} className="text-slate-600 hover:text-brand-700">{p.email}</a> : "—"}</td>
                        <td className="hidden text-slate-600 md:table-cell">{p.phone ?? "—"}</td>
                        <td className="hidden text-slate-600 lg:table-cell">{p.title ?? "—"}</td>
                        <td className="hidden lg:table-cell">
                          <span className="flex flex-wrap gap-1">
                            {hasPortal.has(p.id) && <Badge className="bg-sky-50 text-sky-700 ring-sky-200"><KeyRound className="h-3 w-3" aria-hidden /> Portal</Badge>}
                            {p.marketing_consent && <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Marketing</Badge>}
                            {!hasPortal.has(p.id) && !p.marketing_consent && <span className="text-slate-400">—</span>}
                          </span>
                        </td>
                        <td className="hidden text-slate-500 xl:table-cell">{formatDate(p.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/customers/contacts" params={{ ...sp, page: undefined }} />
          </>
        )}
      </Card>
    </>
  );
}
