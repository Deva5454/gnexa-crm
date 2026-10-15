import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePortal } from "@/lib/auth";
import { searchTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Help center" };

export default async function PortalHelp({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requirePortal();
  let q = supabase.from("kb_articles").select("id, title, slug, body, group_id").order("views", { ascending: false });
  const term = sp.q ? searchTerm(sp.q) : "";
  if (term) q = q.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  const [{ data: articles }, { data: groups }] = await Promise.all([q, supabase.from("kb_groups").select("id, name").order("position")]);
  const sections = [...(groups ?? []), { id: 0, name: "More" }].map((g) => ({ ...g, items: (articles ?? []).filter((a) => (a.group_id ?? 0) === g.id) })).filter((g) => g.items.length);
  return (
    <>
      <div className="mb-8 text-center">
        <BookOpen className="mx-auto mb-2 h-8 w-8 text-brand-500" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Help center</h1>
        <form action="/portal/help" className="relative mx-auto mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search for answers…" className="field h-12 rounded-xl pl-11" />
        </form>
      </div>
      {!sections.length ? <Card><EmptyState icon={BookOpen} title="No articles found" /></Card> : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((g) => (
            <Card key={g.id}>
              <CardHeader title={g.name} />
              <ul className="divide-y divide-slate-100">
                {g.items.map((a) => (
                  <li key={a.id}><Link href={`/portal/help/${a.slug}`} className="block px-5 py-3 text-sm text-slate-700 hover:bg-brand-50/40 hover:text-brand-700">{a.title}</Link></li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
