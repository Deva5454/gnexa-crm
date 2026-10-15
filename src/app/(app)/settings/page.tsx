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
        <CardHeader title="Company" description="Printed on proposals, estimates and invoices." />
        <CardBody>
          <CompanyForm settings={data} />
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
