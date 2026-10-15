import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = { title: "Setup" };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("company_settings").select("*").maybeSingle();
  return (
    <Card>
      <CardHeader title="Company" description="Shown across the workspace and used as the default currency." />
      <CardBody>
        <CompanyForm name={data?.company_name ?? "Gnexa CRM"} currency={data?.currency ?? "INR"} />
      </CardBody>
    </Card>
  );
}
