import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Eye, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth";
import { cn, searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Knowledge base" };

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string }> }) {
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("knowledge_base", "view")) notFound();
  const canEdit = can("knowledge_base", "edit");
  let q = supabase.from("kb_articles").select("id, title, slug, body, views, is_published, group_id, updated_at").order("views", { ascending: false });
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  if (sp.group) q = q.eq("group_id", Number(sp.group));
  if (!canEdit) q = q.eq("is_published", true);
  const [{ data: articles }, { data: groups }] = await Promise.all([q, supabase.from("kb_groups").select("id, name, description").order("position")]);
  const list = articles ?? [];
  const sections = [...(groups ?? []), { id: 0, name: "Uncategorised", description: null as string | null }]
    .map((g) => ({ ...g, items: list.filter((a) => (a.group_id ?? 0) === g.id) }))
    .filter((g) => g.items.length);

  return (
    <>
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-ink-900 px-6 py-10 text-center text-white sm:px-10">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-accent-500/30 blur-3xl" />
        <div className="relative">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-accent-400" />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">How can we help?</h1>
          <p className="mt-1 text-sm text-slate-300">Guides and answers for your team and customers.</p>
          <form action="/knowledge-base" className="relative mx-auto mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search articles…" className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-4 text-sm text-slate-800 shadow-pop focus:outline-none focus:ring-4 focus:ring-brand-300/40" />
          </form>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Link href="/knowledge-base" className={cn("rounded-full px-3 py-1 text-xs font-medium", !sp.group ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>All</Link>
          {groups?.map((g) => (
            <Link key={g.id} href={`/knowledge-base?group=${g.id}`} className={cn("rounded-full px-3 py-1 text-xs font-medium", sp.group === String(g.id) ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200")}>{g.name}</Link>
          ))}
        </div>
        {canEdit && <LinkButton href="/knowledge-base/new"><Plus className="h-4 w-4" /> New article</LinkButton>}
      </div>

      {!sections.length ? (
        <Card><EmptyState icon={BookOpen} title={term ? "No articles match" : "No articles yet"} description={term ? "Try different words." : "Write the first help article."} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {sections.map((g) => (
            <Card key={g.id}>
              <CardHeader title={g.name} description={g.description ?? undefined} action={<span className="text-xs text-slate-400">{g.items.length}</span>} />
              <ul className="divide-y divide-slate-100">
                {g.items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/knowledge-base/${a.slug}`} className="group block px-5 py-3 hover:bg-brand-50/40">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 group-hover:text-brand-700">{a.title}</span>
                        {!a.is_published && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Draft</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body.slice(0, 160)}</p>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Eye className="h-3 w-3" /> {a.views} views</span>
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
