"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signUp } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.message) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-sm text-teal-800">
        <MailCheck className="mb-2 h-6 w-6" />
        {state.message}
        <Link href="/login" className="mt-3 block font-semibold text-teal-900 underline">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <div>
        <label htmlFor="full_name" className="label">Full name</label>
        <input id="full_name" name="full_name" required className="field h-11" />
      </div>
      <div>
        <label htmlFor="email" className="label">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field h-11" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className="field h-11" />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link>
      </p>
    </form>
  );
}
