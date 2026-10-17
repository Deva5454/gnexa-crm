import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleBody } from "@/app/(app)/knowledge-base/article-body";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { loadFormat } from "@/lib/format-server";
import { formatDate } from "@/lib/utils";
import { PublicFeedback } from "../feedback";

type PublicArticle = {
  id: number;
  title: string;
  body: string;
  updated_at: string;
  company: string | null;
  group: { id: number; name: string; color: string } | null;
  related: { title: string; slug: string }[];
};

const load = cache(async (slug: string) => {
  const supabase = await createClient();
  await loadFormat(); // numbers and dates as set in Setup
  const { data } = await supabase.rpc("public_kb_article", { p_slug: slug });
  return (data as PublicArticle | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await load(decodeURIComponent((await params).slug));
  return { title: { absolute: a ? `${a.title} · Help center` : "Help center" } };
}

export default async function PublicArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const a = await load(slug);
  if (!a) notFound();
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      <article className="min-w-0">
        <Link href="/help" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"><ArrowLeft className="h-4 w-4" /> Help center</Link>
        {a.group && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.group.color }} aria-hidden />{a.group.name}</div>
        )}
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-slate-900">{a.title}</h1>
        <Card>
          <CardBody className="p-6 sm:p-8">
            <ArticleBody text={a.body} />
            <p className="mt-6 text-xs text-slate-400">Last updated {formatDate(a.updated_at)}</p>
            <div className="mt-4 border-t border-slate-100 pt-5"><PublicFeedback slug={slug} /></div>
          </CardBody>
        </Card>
        <p className="mt-6 text-center text-sm text-slate-500">Still stuck? <Link href="/portal/tickets/new" className="font-semibold text-brand-600">Sign in and open a ticket</Link></p>
      </article>
      {a.related.length > 0 && (
        <aside>
          <Card>
            <CardHeader title={a.group ? `More in ${a.group.name}` : "Related"} />
            <ul className="divide-y divide-slate-100">
              {a.related.map((r) => (
                <li key={r.slug}><Link href={`/help/${r.slug}`} className="block px-5 py-2.5 text-sm text-slate-700 hover:bg-brand-50/40 hover:text-brand-700">{r.title}</Link></li>
              ))}
            </ul>
          </Card>
        </aside>
      )}
    </div>
  );
}
