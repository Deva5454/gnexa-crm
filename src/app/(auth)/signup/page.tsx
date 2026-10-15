import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Join your team</h1>
      <p className="mb-8 mt-1 text-sm text-slate-500">
        The first account becomes the administrator. Everyone after that is activated by an admin.
      </p>
      <SignupForm />
    </>
  );
}
