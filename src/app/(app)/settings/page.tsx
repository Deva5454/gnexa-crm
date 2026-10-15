import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { CompanyForm } from "./company-form";
import { ResetDemo } from "./reset-demo";

export const metadata: Metadata = { title: "Setup" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("company_settings").select("*").maybeSingle();
  return (
    <>
      <Card>
        <CardHeader title="Company" description="Shown across the workspace and used as the default currency." />
        <CardBody>
          <CompanyForm name={data?.company_name ?? "Gnexa CRM"} currency={data?.currency ?? "INR"} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Demo data"
          description="Restore the sample customers, leads, tasks and notes before a pitch. Staff, roles and pipeline settings are kept."
        />
        <CardBody>
          <ResetDemo />
        </CardBody>
      </Card>
    </>
  );
}
