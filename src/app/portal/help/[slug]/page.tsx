import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { requirePortal } from "@/lib/auth";
import { ArticleBody } from "@/app/(app)/knowledge-base/article-body";
import { ArticleFeedbackPortal } from "../../forms";

export const metadata: Metadata = { title: "Help" };

export default async function PortalArticle({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const { supabase } = await requirePortal();
  const { data: a } = await supabase.from("kb_articles").select("id, title, body, updated_at").eq("slug", slug).maybeSingle();
  if (!a) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900">{a.title}</h1>
      <Card>
        <CardBody className="p-6 sm:p-8">
          <ArticleBody text={a.body} />
          <div className="mt-8 border-t border-slate-100 pt-5"><ArticleFeedbackPortal id={a.id} /></div>
        </CardBody>
      </Card>
      <p className="mt-6 text-center text-sm text-slate-500">Still stuck? <Link href="/portal/tickets/new" className="font-semibold text-brand-600">Open a ticket</Link></p>
    </div>
  );
}
