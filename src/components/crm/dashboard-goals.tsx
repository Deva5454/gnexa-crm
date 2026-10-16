import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { goalProgress } from "@/lib/goals";
import { GoalCards } from "./goal-cards";
import { todayIST } from "@/lib/dates";

export async function DashboardGoals({ className }: { className?: string }) {
  const { supabase, can } = await requireStaff();
  if (!can("reports", "view")) return null;
  const today = todayIST();
  const [{ data: goals }, { data: staff }] = await Promise.all([
    supabase.from("goals").select("*").lte("start_date", today).gte("end_date", today).order("end_date").limit(3),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (!goals?.length) return null;
  const progress = await goalProgress(supabase, goals);
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Goals in progress</h2>
        <Link href="/goals" className="text-xs font-semibold text-brand-600 hover:text-brand-700">All goals →</Link>
      </div>
      <GoalCards goals={goals} progress={progress} staffNames={new Map((staff ?? []).map((s) => [s.id, s.full_name]))} compact />
    </section>
  );
}
