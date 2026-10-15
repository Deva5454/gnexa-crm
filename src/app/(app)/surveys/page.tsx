import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { createSurvey } from "./actions";

export const metadata: Metadata = { title: "Surveys" };

export default async function SurveysPage() {
  const { supabase } = await requireStaff();
  const { data: surveys } = await supabase
    .from("surveys")
    .select("id, title, description, is_active, created_at, survey_questions(count), survey_responses(count)")
    .order("created_at", { ascending: false });
  const n = (x: unknown) => ((x as { count: number }[] | undefined)?.[0]?.count ?? 0);
  return (
    <>
      <PageHeader title="Surveys" description="Ask customers or attendees a few questions with a public link — results are summarised for you." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          {!surveys?.length ? (
            <EmptyState icon={ClipboardList} title="No surveys yet" description="Create one on the right." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {surveys.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/surveys/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{s.title}</Link>
                    <div className="text-xs text-slate-500">{n(s.survey_questions)} questions · created {formatDate(s.created_at)}</div>
                  </div>
                  <Link href={`/surveys/${s.id}/results`} className="text-sm font-semibold text-brand-600 hover:text-brand-800">{n(s.survey_responses)} responses →</Link>
                  <Badge className={s.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : undefined}>{s.is_active ? "Open" : "Closed"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="New survey" />
          <CardBody>
            <form action={createSurvey} className="space-y-3">
              <input name="title" required maxLength={160} placeholder="Title, e.g. Customer satisfaction — Q4" className="field" />
              <textarea name="description" rows={2} placeholder="Short intro for respondents (optional)" className="field" />
              <SubmitButton size="sm" pendingText="Creating…"><Plus className="h-4 w-4" /> Create & add questions</SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
