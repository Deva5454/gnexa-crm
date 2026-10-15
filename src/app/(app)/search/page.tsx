import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, FileSignature, FolderKanban, LifeBuoy, ListChecks, Magnet, Search, UserRound } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/lib/auth";
import { searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const raw = (await searchParams).q ?? "";
  const q = searchTerm(raw);
  const { supabase, can } = await requireStaff();

  if (!q) {
    return (
      <>
        <PageHeader title="Search" />
        <Card><EmptyState icon={Search} title="Type something to search" description="Use the search bar at the top to find customers, contacts, leads and tasks." /></Card>
      </>
    );
  }

  const like = `%${q}%`;
  const [{ data: customers }, { data: contacts }, { data: leads }, { data: tasks }] = await Promise.all([
    supabase.from("customers").select("id, company, city").or(`company.ilike.${like},phone.ilike.${like},vat.ilike.${like}`).limit(10),
    supabase.from("contacts").select("id, first_name, last_name, email, customer_id, customer:customers(company)").or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(10),
    supabase.from("leads").select("id, name, company").or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(10),
    supabase.from("tasks").select("id, name").ilike("name", like).limit(10),
  ]);
  const none = Promise.resolve({ data: null });
  const [{ data: projects }, { data: tickets }, { data: contracts }, { data: articles }] = await Promise.all([
    can("projects", "view") ? supabase.from("projects").select("id, name, customer:customers(company)").ilike("name", like).limit(10) : none,
    can("support", "view") ? supabase.from("tickets").select("id, subject, status").ilike("subject", like).limit(10) : none,
    can("contracts", "view") ? supabase.from("contracts").select("id, subject, customer:customers(company)").ilike("subject", like).limit(10) : none,
    can("knowledge_base", "view") ? supabase.from("kb_articles").select("id, title, slug").or(`title.ilike.${like},body.ilike.${like}`).limit(10) : none,
  ]);

  const groups = [
    { title: "Customers", icon: Building2, items: (customers ?? []).map((c) => ({ key: `c${c.id}`, href: `/customers/${c.id}`, title: c.company, sub: c.city })) },
    { title: "Contacts", icon: UserRound, items: (contacts ?? []).map((c) => ({ key: `p${c.id}`, href: `/customers/${c.customer_id}?tab=contacts`, title: [c.first_name, c.last_name].filter(Boolean).join(" "), sub: [c.email, c.customer?.company].filter(Boolean).join(" · ") })) },
    { title: "Leads", icon: Magnet, items: (leads ?? []).map((l) => ({ key: `l${l.id}`, href: `/leads/${l.id}`, title: l.name, sub: l.company })) },
    { title: "Tasks", icon: ListChecks, items: (tasks ?? []).map((t) => ({ key: `t${t.id}`, href: `/tasks/${t.id}`, title: t.name, sub: null as string | null | undefined })) },
    { title: "Projects", icon: FolderKanban, items: (projects ?? []).map((p) => ({ key: `pr${p.id}`, href: `/projects/${p.id}`, title: p.name, sub: p.customer?.company })) },
    { title: "Tickets", icon: LifeBuoy, items: (tickets ?? []).map((t) => ({ key: `tk${t.id}`, href: `/support/${t.id}`, title: t.subject, sub: t.status.replace("_", " ") })) },
    { title: "Contracts", icon: FileSignature, items: (contracts ?? []).map((c) => ({ key: `ct${c.id}`, href: `/contracts/${c.id}`, title: c.subject, sub: c.customer?.company })) },
    { title: "Help articles", icon: BookOpen, items: (articles ?? []).map((a) => ({ key: `kb${a.id}`, href: `/knowledge-base/${a.slug}`, title: a.title, sub: null })) },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader title={`Results for “${raw}”`} description={`${groups.reduce((s, g) => s + g.items.length, 0)} matches`} />
      {!groups.length ? (
        <Card><EmptyState icon={Search} title="No matches" description="Try a shorter or different search term." /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.title}>
              <CardHeader title={<span className="flex items-center gap-2"><g.icon className="h-4 w-4 text-brand-500" />{g.title}</span>} />
              <ul className="divide-y divide-slate-100">
                {g.items.map((i) => (
                  <li key={i.key}>
                    <Link href={i.href} className="block px-5 py-3 hover:bg-brand-50/40">
                      <div className="text-sm font-medium text-slate-900">{i.title}</div>
                      {i.sub && <div className="text-xs text-slate-500">{i.sub}</div>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
