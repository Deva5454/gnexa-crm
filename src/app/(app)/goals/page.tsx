import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { GoalCards } from "@/components/crm/goal-cards";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireFeature, requireStaff } from "@/lib/auth";
import { goalProgress } from "@/lib/goals";
import { GoalForm } from "./goal-form";
import { todayIST } from "@/lib/dates";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  await requireFeature("goals"); // Setup → Modules
  const { supabase, can } = await requireStaff();
  if (!can("reports", "view")) notFound();
  const [{ data: goals }, { data: staff }] = await Promise.all([
    supabase.from("goals").select("*").order("end_date"),
    supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const progress = await goalProgress(supabase, goals ?? []);
  const today = todayIST();
  const current = (goals ?? []).filter((g) => g.end_date >= today);
  const past = (goals ?? []).filter((g) => g.end_date < today);
  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  return (
    <>
      <PageHeader title="Goals" description="Targets with live progress. The marker shows where you should be by today." />
      {can("reports", "edit") && (
        <Card className="mb-6">
          <CardHeader title="New goal" />
          <CardBody><GoalForm staff={staff ?? []} /></CardBody>
        </Card>
      )}
      {!current.length ? <Card><EmptyState icon={Target} title="No active goals" description="Set a target for invoicing, collections, leads or support." /></Card> : <GoalCards goals={current} progress={progress} staffNames={names} canDelete={can("reports", "full")} />}
      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-500">Past goals</h2>
          <GoalCards goals={past} progress={progress} staffNames={names} canDelete={can("reports", "full")} />
        </>
      )}
    </>
  );
}
