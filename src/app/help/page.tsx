import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Search } from "lucide-react";
import { plainExcerpt } from "@/app/(app)/knowledge-base/article-body";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { absolute: "Help center" } };

type PublicKb = {
  company: string | null;
  groups: { id: number; name: string; description: string | null; color: string }[];
  articles: { title: string; slug: string; group_id: number | null; excerpt: string }[];
};

/** Perfex's public knowledge base: published, customer-facing articles for anyone (when switched on in Setup → Support). */
export default async function PublicHelp({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_kb", { p_q: sp.q?.slice(0, 80) ?? null });
  const kb = data as PublicKb | null;
  if (!kb) notFound();
  const sections = [...kb.groups, { id: 0, name: "More", description: null, color: "#94a3b8" }]
    .map((g) => ({ ...g, items: kb.articles.filter((a) => (a.group_id ?? 0) === g.id) }))
    .filter((g) => g.items.length);
  return (
    <>
      <div className="mb-8 text-center">
        <BookOpen className="mx-auto mb-2 h-8 w-8 text-brand-500" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{kb.company ? `${kb.company} help center` : "Help center"}</h1>
        <form action="/help" className="relative mx-auto mt-5 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search for answers…" aria-label="Search articles" className="field h-12 rounded-xl pl-11" />
        </form>
      </div>
      {!sections.length ? (
        <Card><EmptyState icon={BookOpen} title={sp.q ? "No articles match" : "No articles yet"} description={sp.q ? "Try different words." : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((g) => (
            <Card key={g.id}>
              <div className="h-1 rounded-t-2xl" style={{ backgroundColor: g.color }} aria-hidden />
              <CardHeader title={g.name} description={g.description ?? undefined} />
              <ul className="divide-y divide-slate-100">
                {g.items.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`} className="block px-5 py-3 hover:bg-brand-50/40">
                      <span className="text-sm font-medium text-slate-800">{a.title}</span>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{plainExcerpt(a.excerpt)}</p>
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
