"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { resetDemoData } from "./actions";

export function ResetDemo() {
  const [state, action] = useActionState(resetDemoData, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Wipe all customers, leads, tasks and notes and restore the original demo data?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <FormError message={state?.error} />
      {state?.ok && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</div>}
      <SubmitButton variant="secondary" pendingText="Restoring…">
        <RotateCcw className="h-4 w-4" /> Reset demo data
      </SubmitButton>
    </form>
  );
}
