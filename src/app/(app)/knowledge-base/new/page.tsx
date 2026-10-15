import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccess } from "@/lib/auth";
import { saveArticle } from "../actions";
import { ArticleForm } from "../article-form";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticlePage() {
  const { supabase } = await requireAccess("knowledge_base", "edit", "/knowledge-base");
  const { data: groups } = await supabase.from("kb_groups").select("id, name").order("position");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New article" description="Answer a question once — link it from every ticket." />
      <ArticleForm action={saveArticle.bind(null, null)} groups={groups ?? []} cancelHref="/knowledge-base" />
    </div>
  );
}
