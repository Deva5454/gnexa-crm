"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <FormError message={state?.error} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field h-11" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field h-11" />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        New to the team?{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:text-brand-700">Create an account</Link>
      </p>
    </form>
  );
}
