import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveArticle } from "../../actions";
import { ArticleForm } from "../../article-form";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const { supabase } = await requireAccess("knowledge_base", "edit", `/knowledge-base/${slug}`);
  const [{ data: a }, { data: groups }] = await Promise.all([
    supabase.from("kb_articles").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("kb_groups").select("id, name").order("position"),
  ]);
  if (!a) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Edit article" />
      <ArticleForm action={saveArticle.bind(null, a.id)} article={a} groups={groups ?? []} cancelHref={`/knowledge-base/${a.slug}`} />
    </div>
  );
}
