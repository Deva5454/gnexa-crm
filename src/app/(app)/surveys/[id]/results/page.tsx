import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { BarList } from "@/components/reports/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Q_TYPES } from "../../types";

export const metadata: Metadata = { title: "Survey results" };

export default async function SurveyResultsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("surveys"); // Setup → Modules
  const id = Number((await params).id);
  const { supabase } = await requireStaff();
  const [{ data: s }, { data: questions }, { data: responses }] = await Promise.all([
    supabase.from("surveys").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("survey_questions").select("*").eq("survey_id", id).order("position").order("id"),
    supabase.from("survey_responses").select("id, name, email, created_at, survey_answers(question_id, value)").eq("survey_id", id).order("created_at", { ascending: false }),
  ]);
  if (!s) notFound();
  const all = responses ?? [];
  const answersFor = (qid: number) => all.flatMap((r) => r.survey_answers.filter((a) => a.question_id === qid).map((a) => ({ value: a.value, who: r.name, at: r.created_at })));

  return (
    <>
      <PageHeader eyebrow={<Link href={`/surveys/${id}`} className="hover:text-brand-600">{s.title}</Link>} title="Results" description={`${all.length} response${all.length === 1 ? "" : "s"}`} />
      <div className="space-y-6">
        {(questions ?? []).map((q, i) => {
          const ans = answersFor(q.id);
          const answered = new Set(all.filter((r) => r.survey_answers.some((a) => a.question_id === q.id)).map((r) => r.id)).size;
          return (
            <Card key={q.id}>
              <CardHeader title={`${i + 1}. ${q.label}`} description={`${Q_TYPES[q.type]} · ${answered} of ${all.length} answered`} />
              <CardBody>
                {q.type === "rating" ? (
                  (() => {
                    const nums = ans.map((a) => Number(a.value)).filter((n) => n >= 1 && n <= 5);
                    const avg = nums.length ? nums.reduce((t, n) => t + n, 0) / nums.length : 0;
                    return (
                      <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
                        <div>
                          <div className="text-4xl font-bold text-slate-900">{avg ? avg.toFixed(1) : "—"}</div>
                          <div className="mt-1 flex gap-0.5 text-amber-400" aria-label={`Average ${avg.toFixed(1)} out of 5`}>
                            {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= Math.round(avg) ? "h-4 w-4 fill-current" : "h-4 w-4 text-slate-200"} />)}
                          </div>
                          <div className="text-xs text-slate-400">average of {nums.length}</div>
                        </div>
                        <BarList format="number" items={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n === 1 ? "" : "s"}`, value: nums.filter((x) => x === n).length }))} />
                      </div>
                    );
                  })()
                ) : q.type === "single" || q.type === "multiple" ? (
                  <BarList
                    format="number"
                    items={q.options.map((o) => {
                      const c = ans.filter((a) => a.value === o).length;
                      return { label: o, value: c, sub: answered ? `${Math.round((c / answered) * 100)}%` : undefined };
                    })}
                  />
                ) : !ans.length ? (
                  <p className="text-sm text-slate-400">No answers yet.</p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto">
                    {ans.map((a, k) => (
                      <li key={k} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {a.value}
                        <span className="mt-0.5 block text-[11px] text-slate-400" suppressHydrationWarning>{a.who ?? "Anonymous"} · {formatDateTime(a.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          );
        })}
        <Card>
          <CardHeader title="Respondents" />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Name</th><th>E-mail</th><th>Submitted</th></tr></thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.id}><td>{r.name ?? "Anonymous"}</td><td className="text-slate-500">{r.email ?? "—"}</td><td className="text-slate-500" suppressHydrationWarning>{formatDateTime(r.created_at)}</td></tr>
                ))}
                {!all.length && <tr><td colSpan={3} className="text-slate-400">No responses yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
