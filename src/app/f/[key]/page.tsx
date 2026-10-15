import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { createClient } from "@/lib/supabase/server";
import { PublicForm } from "../public-form";

type Info = { name: string; kind: string; intro: string | null; fields: string[]; required: string[]; company: string };

async function info(key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("web_form_info", { p_key: key });
  return (data as Info | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const i = await info((await params).key);
  return { title: { absolute: i ? `${i.name} · ${i.company}` : "Form" }, robots: { index: false } };
}

export default async function PublicFormPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ embed?: string }> }) {
  const key = (await params).key;
  const i = await info(key);
  if (!i) notFound();
  return (
    <PublicShell company={i.company} embed={(await searchParams).embed === "1"}>
      <h1 className="text-xl font-bold text-slate-900">{i.name}</h1>
      {i.intro && <p className="mt-1 text-sm text-slate-500">{i.intro}</p>}
      <div className="mt-6">
        <PublicForm formKey={key} fields={i.fields} required={i.required} kind={i.kind} />
      </div>
    </PublicShell>
  );
}
