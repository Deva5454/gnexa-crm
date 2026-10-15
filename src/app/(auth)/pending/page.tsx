import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Awaiting approval" };

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).single();
  if (profile?.is_active) redirect("/dashboard");

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <Hourglass className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Waiting for approval</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your account <b className="text-slate-700">{user.email}</b> was created. An administrator needs to activate it
        under <i>Setup → Staff</i> before you can access the CRM.
      </p>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
