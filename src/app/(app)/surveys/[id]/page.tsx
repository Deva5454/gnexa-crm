import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireFeature, requireStaff } from "@/lib/auth";
import { CopyBox } from "../../settings/web-forms/copy-box";
import { deleteQuestion, deleteSurvey, saveQuestion, updateSurvey } from "../actions";
import { Q_TYPES } from "../types";

export const metadata: Metadata = { title: "Survey" };

function QuestionFields({ q }: { q?: { label: string; type: string; options: string[]; required: boolean } }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
      <input name="label" defaultValue={q?.label} required maxLength={300} placeholder="Question" className="field" />
      <select name="type" defaultValue={q?.type ?? "short"} className="field" aria-label="Answer type">
        {Object.entries(Q_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input name="options" defaultValue={q?.options.join(", ")} placeholder="Choices, comma-separated (choice questions only)" className="field sm:col-span-2" />
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="required" defaultChecked={q?.required} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Required</label>
    </div>
  );
}

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("surveys"); // Setup → Modules
  const id = Number((await params).id);
  const { supabase } = await requireStaff();
  const [{ data: s }, { data: questions }, { count }] = await Promise.all([
    supabase.from("surveys").select("*").eq("id", id).maybeSingle(),
    supabase.from("survey_questions").select("*").eq("survey_id", id).order("position").order("id"),
    supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", id),
  ]);
  if (!s) notFound();

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/surveys" className="hover:text-brand-600">Surveys</Link>}
        title={<span className="flex items-center gap-3">{s.title}<Badge className={s.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}>{s.is_active ? "Open" : "Closed"}</Badge></span>}
        actions={
          <>
            <LinkButton href={`/surveys/${id}/results`} size="sm"><BarChart3 className="h-3.5 w-3.5" /> Results ({count ?? 0})</LinkButton>
            <ConfirmForm action={deleteSurvey} message={`Delete “${s.title}” and all ${count ?? 0} responses?`}>
              <input type="hidden" name="id" value={id} />
              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" aria-label="Delete survey"><Trash2 className="h-3.5 w-3.5" /></Button>
            </ConfirmForm>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {(questions ?? []).map((q, i) => (
            <Card key={q.id}>
              <CardBody>
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Question {i + 1} · {Q_TYPES[q.type]}</span>
                  <ConfirmForm action={deleteQuestion} message="Delete this question and its answers?">
                    <input type="hidden" name="id" value={q.id} />
                    <button className="inline-flex items-center gap-1 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                  </ConfirmForm>
                </div>
                <form action={saveQuestion} className="space-y-2">
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="survey_id" value={id} />
                  <QuestionFields q={q} />
                  <div className="flex justify-end"><SubmitButton size="sm" variant="secondary" pendingText="…">Save</SubmitButton></div>
                </form>
              </CardBody>
            </Card>
          ))}
          <Card>
            <CardHeader title="Add a question" />
            <CardBody>
              <form action={saveQuestion} className="space-y-2">
                <input type="hidden" name="survey_id" value={id} />
                <QuestionFields />
                <SubmitButton size="sm" pendingText="Adding…"><Plus className="h-4 w-4" /> Add question</SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Share" description="Anyone with the link can respond while the survey is open." />
            <CardBody><CopyBox path={`/s/${s.key}`} embed={false} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Settings" />
            <CardBody>
              <form action={updateSurvey} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <input name="title" defaultValue={s.title} required className="field" aria-label="Title" />
                <textarea name="description" defaultValue={s.description ?? ""} rows={2} placeholder="Intro" className="field" aria-label="Intro" />
                <input name="thank_you" defaultValue={s.thank_you} className="field" aria-label="Thank-you message" />
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="is_active" defaultChecked={s.is_active} className="h-4 w-4 rounded border-slate-300 text-brand-600" /> Accepting responses</label>
                <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save settings</SubmitButton>
              </form>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
