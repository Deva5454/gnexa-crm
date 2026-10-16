import type { Metadata } from "next";
import { DatabaseBackup, Download } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Database backup" };

export default async function BackupPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Database backup" description="Download a copy of all your CRM data." />
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <DatabaseBackup className="h-10 w-10 shrink-0 text-brand-500" />
          <div className="flex-1 text-sm text-slate-600">
            <p className="font-medium text-slate-800">One JSON file with every customer, lead, invoice, payment, task, project, ticket and setting.</p>
            <p className="mt-1">Uploaded files (attachments, receipts, media) aren&apos;t included. Supabase also keeps automatic daily backups of the database — restore those from the Supabase dashboard.</p>
          </div>
          <a href="/backup/download" className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            <Download className="h-4 w-4" /> Download backup
          </a>
        </CardBody>
      </Card>
    </>
  );
}
