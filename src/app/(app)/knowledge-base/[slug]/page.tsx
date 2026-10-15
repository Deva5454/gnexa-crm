import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Pencil, ThumbsUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { deleteArticle } from "../actions";
import { ArticleBody } from "../article-body";
import { ArticleFeedback } from "./feedback";

export const metadata: Metadata = { title: "Article" };

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const { supabase, can } = await requireStaff();
  if (!can("knowledge_base", "view")) notFound();
  const { data: a } = await supabase.from("kb_articles").select("*, group:kb_groups(id, name), author:profiles(full_name)").eq("slug", slug).maybeSingle();
  if (!a) notFound();
  const { data: related } = a.group_id
    ? await supabase.from("kb_articles").select("id, title, slug").eq("group_id", a.group_id).eq("is_published", true).neq("id", a.id).limit(5)
    : { data: [] as { id: number; title: string; slug: string }[] };
  const votes = a.helpful + a.not_helpful;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <article>
        <div className="mb-2 text-xs font-medium text-slate-500">
          <Link href="/knowledge-base" className="hover:text-brand-600">Knowledge base</Link>
          {a.group && <> / <Link href={`/knowledge-base?group=${a.group.id}`} className="hover:text-brand-600">{a.group.name}</Link></>}
        </div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{a.title}</h1>
          <div className="flex shrink-0 gap-2">
            {can("knowledge_base", "edit") && <LinkButton href={`/knowledge-base/${a.slug}/edit`} variant="secondary" size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</LinkButton>}
            {can("knowledge_base", "full") && (
              <ConfirmForm action={deleteArticle} message={`Delete “${a.title}”?`}>
                <input type="hidden" name="id" value={a.id} />
                <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete article"><Trash2 className="h-3.5 w-3.5" /></Button>
              </ConfirmForm>
            )}
          </div>
        </div>
        <Card>
          <CardBody className="p-6 sm:p-8">
            {!a.is_published && <Badge className="mb-4 bg-amber-50 text-amber-700 ring-amber-200">Draft — not published</Badge>}
            <ArticleBody text={a.body} />
            <div className="mt-8 border-t border-slate-100 pt-5"><ArticleFeedback id={a.id} /></div>
          </CardBody>
        </Card>
      </article>
      <aside className="space-y-6">
        <Card>
          <CardHeader title="About" />
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Author</span><span>{a.author?.full_name ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Updated</span><span>{formatDate(a.updated_at)}</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1 text-slate-500"><Eye className="h-3.5 w-3.5" /> Views</span><span>{a.views}</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1 text-slate-500"><ThumbsUp className="h-3.5 w-3.5" /> Helpful</span><span>{votes ? `${Math.round((a.helpful / votes) * 100)}% of ${votes}` : "—"}</span></div>
          </CardBody>
        </Card>
        {(related?.length ?? 0) > 0 && (
          <Card>
            <CardHeader title={`More in ${a.group?.name}`} />
            <ul className="divide-y divide-slate-100">
              {related!.map((r) => (
                <li key={r.id}><Link href={`/knowledge-base/${r.slug}`} className="block px-5 py-2.5 text-sm text-slate-700 hover:bg-brand-50/40 hover:text-brand-700">{r.title}</Link></li>
              ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}
