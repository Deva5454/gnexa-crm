import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Eye, Globe, LayoutGrid, List, Plus, Search } from "lucide-react";
import { BulkBar, SelectAll } from "@/components/crm/bulk-bar";
import { ParamSelect } from "@/components/ui/param-select";
import { bulkArticles } from "./actions";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { plainExcerpt } from "@/app/(app)/knowledge-base/article-body";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/auth";
import { cn, formatDate, searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Knowledge base" };

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string; status?: string; view?: string }> }) {
  const sp = await searchParams;
  const { supabase, can } = await requireStaff();
  if (!can("knowledge_base", "view")) notFound();
  const canEdit = can("knowledge_base", "edit");
  const listView = sp.view === "list";
  let q = supabase
    .from("kb_articles")
    .select("id, title, slug, body, views, helpful, not_helpful, is_published, is_internal, position, group_id, updated_at")
    .order("position")
    .order("views", { ascending: false });
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  if (sp.group) q = q.eq("group_id", Number(sp.group));
  if (!canEdit) q = q.eq("is_published", true);
  if (sp.status === "published") q = q.eq("is_published", true);
  if (sp.status === "draft") q = q.eq("is_published", false);
  if (sp.status === "internal") q = q.eq("is_internal", true);
  if (sp.status === "customer") q = q.eq("is_internal", false).eq("is_published", true);
  const [{ data: articles }, { data: groups }, { data: cs }] = await Promise.all([
    q,
    supabase.from("kb_groups").select("id, name, description, color, is_active").order("position"),
    supabase.from("company_settings").select("kb_public").maybeSingle(),
  ]);
  const list = articles ?? [];
  const groupOf = (id: number | null) => (groups ?? []).find((g) => g.id === id);
  const href = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) n.set(k, v);
    const qs = n.toString();
    return qs ? `/knowledge-base?${qs}` : "/knowledge-base";
  };
  const pill = (active: boolean) => cn("rounded-full px-3 py-1 text-xs font-medium", active ? "bg-ink-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50");
  const sections = [...(groups ?? []), { id: 0, name: "Uncategorised", description: null as string | null, color: "#94a3b8", is_active: true }]
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
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={href({ group: undefined })} className={pill(!sp.group)}>All</Link>
          {groups?.map((g) => (
            <Link key={g.id} href={href({ group: sp.group === String(g.id) ? undefined : String(g.id) })} className={cn(pill(sp.group === String(g.id)), "inline-flex items-center gap-1.5", !g.is_active && "opacity-60")}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} aria-hidden /> {g.name}
            </Link>
          ))}
          {canEdit && (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <ParamSelect
                name="status"
                label="Status"
                allLabel="Any status"
                options={[
                  { value: "published", label: "Published" },
                  { value: "draft", label: "Drafts" },
                  { value: "internal", label: "Internal (staff only)" },
                  { value: "customer", label: "Seen by customers" },
                ]}
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            <Link href={href({ view: undefined })} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", !listView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}><LayoutGrid className="h-3.5 w-3.5" /> Groups</Link>
            <Link href={href({ view: "list" })} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", listView ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}><List className="h-3.5 w-3.5" /> List</Link>
          </div>
          {canEdit && <LinkButton href="/knowledge-base/new"><Plus className="h-4 w-4" /> New article</LinkButton>}
        </div>
      </div>
      {canEdit && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
          <Globe className="h-3.5 w-3.5" />
          {cs?.kb_public ? <>Public help center is on — anyone can read published, non-internal articles at <a href="/help" target="_blank" className="font-medium text-brand-700 underline">/help</a>.</> : <>Customers read articles in the client portal. A public help center (no sign-in) can be switched on in Setup → Support.</>}
        </p>
      )}

      {listView ? (
        <Card>
          {!list.length ? (
            <EmptyState icon={BookOpen} title={term ? "No articles match" : "No articles yet"} />
          ) : (
            <>
              {canEdit && (
                <BulkBar
                  id="kb-bulk"
                  action={bulkArticles}
                  noun="article"
                  ops={[
                    { value: "publish", label: "Publish" },
                    { value: "unpublish", label: "Unpublish (draft)" },
                    { value: "internal", label: "Make internal (staff only)" },
                    { value: "public", label: "Show to customers" },
                    { value: "group", label: "Move to group", target: { label: "Group", options: (groups ?? []).map((g) => ({ value: String(g.id), label: g.name })) } },
                    ...(can("knowledge_base", "full") ? [{ value: "delete", label: "Delete", danger: true }] : []),
                  ]}
                />
              )}
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      {canEdit && <th className="w-8"><SelectAll form="kb-bulk" label="Select all articles" /></th>}
                      <th>Article</th>
                      <th className="hidden md:table-cell">Group</th>
                      <th className="hidden sm:table-cell text-right">Views</th>
                      <th className="hidden lg:table-cell text-right">Helpful</th>
                      <th className="hidden md:table-cell">Updated</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => {
                      const g = groupOf(a.group_id);
                      const votes = a.helpful + a.not_helpful;
                      return (
                        <tr key={a.id}>
                          {canEdit && <td><input type="checkbox" name="ids" value={a.id} form="kb-bulk" aria-label={`Select ${a.title}`} className="h-4 w-4 rounded border-slate-300 text-brand-600" /></td>}
                          <td><Link href={`/knowledge-base/${a.slug}`} className="font-medium text-slate-900 hover:text-brand-700">{a.title}</Link></td>
                          <td className="hidden md:table-cell">{g ? <span className="inline-flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />{g.name}</span> : <span className="text-slate-400">—</span>}</td>
                          <td className="hidden text-right tabular-nums sm:table-cell">{a.views}</td>
                          <td className="hidden text-right tabular-nums lg:table-cell">{votes ? `${Math.round((a.helpful / votes) * 100)}% · ${votes}` : "—"}</td>
                          <td className="hidden whitespace-nowrap text-slate-600 md:table-cell">{formatDate(a.updated_at)}</td>
                          <td className="space-x-1 whitespace-nowrap">
                            {a.is_published ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Published</Badge> : <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Draft</Badge>}
                            {a.is_internal && <Badge className="bg-violet-50 text-violet-700 ring-violet-200">Internal</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : !sections.length ? (
        <Card><EmptyState icon={BookOpen} title={term ? "No articles match" : "No articles yet"} description={term ? "Try different words." : "Write the first help article."} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {sections.map((g) => (
            <Card key={g.id}>
              <div className="h-1 rounded-t-2xl" style={{ backgroundColor: g.color }} aria-hidden />
              <CardHeader title={g.is_active ? g.name : `${g.name} (hidden from customers)`} description={g.description ?? undefined} action={<span className="text-xs text-slate-400">{g.items.length}</span>} />
              <ul className="divide-y divide-slate-100">
                {g.items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/knowledge-base/${a.slug}`} className="group block px-5 py-3 hover:bg-brand-50/40">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 group-hover:text-brand-700">{a.title}</span>
                        <span className="flex shrink-0 gap-1">
                          {!a.is_published && <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Draft</Badge>}
                          {a.is_internal && <Badge className="bg-violet-50 text-violet-700 ring-violet-200">Internal</Badge>}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{plainExcerpt(a.body)}</p>
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
