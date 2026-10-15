import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { createClient } from "@/lib/supabase/server";
import { SurveyForm } from "../survey-form";

type Info = { title: string; description: string | null; company: string; questions: { id: number; label: string; type: string; options: string[]; required: boolean }[] };

async function info(key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("survey_info", { p_key: key });
  return (data as Info | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const i = await info((await params).key);
  return { title: { absolute: i ? `${i.title} · ${i.company}` : "Survey" }, robots: { index: false } };
}

export default async function PublicSurveyPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ embed?: string }> }) {
  const key = (await params).key;
  const i = await info(key);
  if (!i) notFound();
  return (
    <PublicShell company={i.company} embed={(await searchParams).embed === "1"}>
      <h1 className="text-xl font-bold text-slate-900">{i.title}</h1>
      {i.description && <p className="mt-1 text-sm text-slate-500">{i.description}</p>}
      <div className="mt-6">
        <SurveyForm surveyKey={key} questions={i.questions} />
      </div>
    </PublicShell>
  );
}
