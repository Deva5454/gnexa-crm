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
      {data?.demo_mode !== false && (
        <>
          <Card>
            <CardHeader
              title="Demo data"
              description="Restore the sample customers, leads, tasks and notes before a pitch. Staff and pipeline settings are kept; the demo roles' permissions are restored."
            />
            <CardBody>
              <ResetDemo />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Going live" description="This install is running as a public demo. Only the owner can switch that off." />
            <CardBody className="space-y-2 text-sm text-slate-600">
              <p>1. In Supabase, open <b>Authentication → Users → Add user</b> and create your own account.</p>
              <p>
                2. In the Supabase <b>SQL editor</b>, run <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">select private.go_live(&apos;you@yourcompany.com&apos;);</code> —
                or add <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">, true</code> to also clear the demo data.
              </p>
              <p>3. Sign in at <b>/login</b> with your account. The demo accounts are switched off and the role switcher disappears.</p>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
