"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { submitSurvey, type SurveyState } from "./actions";

type Q = { id: number; label: string; type: string; options: string[]; required: boolean };

function Rating({ q }: { q: Q }) {
  const [v, setV] = useState(0);
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={q.label}>
      <input type="hidden" name={`q_${q.id}`} value={v ? String(v) : ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={v === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setV(n)} className="rounded p-0.5">
          <Star className={cn("h-8 w-8 transition", n <= v ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300")} />
        </button>
      ))}
    </div>
  );
}

export function SurveyForm({ surveyKey, questions }: { surveyKey: string; questions: Q[] }) {
  const [state, action] = useActionState<SurveyState, FormData>(submitSurvey.bind(null, surveyKey), undefined);
  if (state?.ok)
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-accent-500" />
        <p className="text-base font-semibold text-slate-900">{state.ok}</p>
      </div>
    );
  return (
    <form action={action} className="space-y-6">
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="text-sm font-semibold text-slate-800">
            {i + 1}. {q.label}{q.required && <span className="text-rose-500"> *</span>}
          </legend>
          {q.type === "short" && <input name={`q_${q.id}`} required={q.required} maxLength={500} className="field" aria-label={q.label} />}
          {q.type === "long" && <textarea name={`q_${q.id}`} required={q.required} maxLength={4000} rows={4} className="field" aria-label={q.label} />}
          {q.type === "rating" && <Rating q={q} />}
          {(q.type === "single" || q.type === "multiple") && (
            <div className="space-y-1.5">
              {q.type === "multiple" && <input type="hidden" name={`multi_${q.id}`} value="1" />}
              {q.options.map((o) => (
                <label key={o} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50">
                  <input type={q.type === "single" ? "radio" : "checkbox"} name={`q_${q.id}`} value={o} required={q.type === "single" && q.required} className="h-4 w-4 border-slate-300 text-brand-600" />
                  {o}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <div className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <input name="name" maxLength={120} placeholder="Your name (optional)" className="field" aria-label="Your name" autoComplete="name" />
        <input name="email" type="email" maxLength={160} placeholder="E-mail (optional)" className="field" aria-label="E-mail" autoComplete="email" />
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <SubmitButton className="w-full" pendingText="Sending…">Submit</SubmitButton>
    </form>
  );
}
